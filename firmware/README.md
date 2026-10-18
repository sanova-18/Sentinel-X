# SentinelX ESP32 integration

Prepared and software-tested on 15 October 2026. Start with **QUICKSTART.md** for the friend connecting the hardware. This extends the existing SentinelX project; it does not recreate the dashboard, backend or database.

## Delivered hardware support

Classic ESP32-WROOM/DevKit with MAX30102, DHT11, MQ-5, MPU6050 and buzzer. SOS and LED are disabled because they are not present. The board model, real pin assignments, electrical conditioning and buzzer type must be checked by the person holding the hardware. No physical upload or sensor test has been performed here.

`sentinelx_esp32/` must remain a complete folder. Open `sentinelx_esp32.ino`, copy `config.example.h` to local `config.h`, and edit the existing definitions. Supplied defaults keep `HARDWARE_CONFIRMED`, `NETWORK_ENABLED`, gas conditioning and experimental fall/inactivity detection false. Never distribute a completed config containing passwords. The sketch deliberately rejects ESP32-C3/S2/S3 until adapted for that board.

## Installed and verified on the Mac

Arduino CLI 1.5.1, ESP32 core 3.3.12, and all requested libraries are installed in the isolated `Documents/Codex/toolchains/sentinelx-arduino` folder. The core downloads total 1,789,334,063 bytes (1.79 GB / 1.67 GiB); all archives were SHA256-verified. Arduino IDE is optional; CLI compilation works.

| Library | Version |
|---|---|
| Adafruit MPU6050 | 2.2.9 |
| Adafruit Unified Sensor | 1.1.15 |
| Adafruit BusIO | 1.17.4 |
| SparkFun MAX3010x Pulse and Proximity Sensor Library | 1.1.2 |
| DHT sensor library | 1.4.7 |
| PubSubClient | 2.8 |
| ArduinoJson | 7.4.3 |

The SparkFun package includes `spo2_algorithm`. Preferences/NVS comes with the ESP32 core. Adafruit GFX 1.12.6 and SSD1306 2.5.17 were installed as declared dependencies. Node 22.14.0, npm 10.9.2, PostgreSQL 16.15, Mosquitto 2.1.2 and simulator Paho MQTT 2.1.0 already existed and were retained.

The bundled Arduino ctags executable was Intel-only and failed on this Mac without Rosetta. Arduino ctags tag `5.8-arduino11` was built natively using the installed compiler; its internal reserved `__unused__` macro was renamed to `ARDUINO_CTAGS_UNUSED` to avoid the modern macOS SDK collision. Only the isolated toolchain executable was replaced; the original remains `ctags.x86_64`. Source archive SHA256: `86ca843c62aecb9bc531a73d9b6cef33179bd885b1bf8df9e0c7e9761aa9794d`.

## Backend and simulator changes

The existing nested payload contract is retained. Backend Zod validators now reject invalid dates; both handlers verify the assigned worker/helmet pair, and topics must match the payload helmet. The database has additive nullable `is_simulated` fields on readings/incidents and a durable `alert_receipts` table. Historical records remain unknown; nothing was reset or reseeded. The generated Prisma client was updated.

`isSimulated:false` means hardware-reported, true means simulated and null/missing means unknown. The flag is declared by the sender, not authenticated proof of a physical measurement. Source labels persist through PostgreSQL, REST, Socket.IO, worker cards, incidents and history. Hardware and simulated hazards do not suppress each other. Operator-acknowledged hazards remain grouped until resolved. The dashboard refreshes saved state after reconnect.

The simulator supports `--exclude-helmet H-201` or comma-separated `SENTINELX_HARDWARE_HELMETS`. Stop any older simulator instance first; restarting scenarios in the updated filtered instance does not re-enable the reserved helmet.

## MQTT contract

- Telemetry: `sentinelx/{helmetId}/telemetry`
- Immediate alert: `sentinelx/{helmetId}/alert`
- Backend persistence acknowledgement: `sentinelx/{helmetId}/ack`

Telemetry contains `messageId`, `helmetId`, `workerId`, UTC `timestamp`, nested `vitals` (`heartRate`, `spo2`), `environment` (`temperature`, `humidity`, integer `gasRaw`), `motion` (`fallDetected`, `inactivityDetected`) and `isSimulated:false`. Invalid/unavailable numeric measurements are null. Gas uses the existing 0–1023 raw scale, not ppm. Motion booleans cannot express unknown sensor state; check serial sensor-health messages.

Alerts contain a stable `eventId`, assigned IDs, UTC timestamp, `alertType`, severity, description and `isSimulated:false`. The backend commits the receipt and incident together, then publishes this non-retained acknowledgement at QoS1:

```json
{"helmetId":"H-201","workerId":"W-101","eventId":"SAME_EVENT_ID","status":"persisted"}
```

PubSubClient sends QoS0. A successful write does not remove an event: the device retries every five seconds until a matching application ACK is received and the NVS removal commits. The eight-slot NVS outbox stores explicit fall/optional SOS events, preserving event ID and original identity through reboot. Full/failed storage is reported on serial and the local alarm remains latched. This is bounded prototype delivery support, not guaranteed emergency delivery. Drain pending events before changing assignments; the backend rejects old assignments.

Telemetry retains only its latest snapshot and is not replayed after outages. Gas, vitals and temperature generate local alarm latches and backend telemetry-rule incidents; their offline history is not stored in the explicit-event outbox. Only fall/SOS events use that outbox. Local serial `r` clears the buzzer/fall latch, but does not resolve dashboard incidents or discard queued events.

Wi-Fi/MQTT run in a separate FreeRTOS task. The sensor loop uses checked I2C reads, validates sensor configuration, retries missing sensors and resets motion/PPG continuity after gaps. MAX30102 uses 100 samples/s averaged by four, a 100-sample algorithm window and 25-sample updates. DHT11 is sampled every 2.5 seconds; telemetry every 2 seconds. NVS flash writes may briefly interrupt sampling, which resets continuity when the gap exceeds its limit.

Valid SNTP time is required before timestamped messages are sent. Local sensing continues while time/network are unavailable. If an unsynchronized queued event survives reboot, its original capture time cannot be recovered; the description explicitly identifies its timestamp as estimated delivery time. Already synchronized event timestamps are preserved.

## Running the updated software

The existing service on port 5001 was started before these edits and still needs a restart. macOS sandboxing prevented this session from stopping that pre-existing process. Stop the old SentinelX backend in its original terminal/IDE, then start the updated code:

```sh
cd /Users/varunshrotri/.gemini/antigravity/scratch/sentinelx/backend
npm run dev
```

The database update and Prisma generation are already applied on this Mac. Do not repeat a database reset or seed. For another existing database, review `backend/prisma/migrations/202610150001_sensor_source/README.md` before applying the additive SQL and regenerating Prisma.

Confirm `/api/health` reports `dataSourceMode: "per-message"`. Refresh the existing dashboard at `http://localhost:5174`. Mosquitto remains on port1883. No broker/firewall/login-service settings were changed. The ESP32 must reach the Mac's current LAN/private address on a compatible 2.4GHz network; a friend in another location cannot reach a private address without a private route. Do not use localhost as the board's broker address.

From the project root:

```sh
sh firmware/build.sh
sh firmware/test-payloads.sh
sh firmware/test-sensor-logic.sh
simulator/venv/bin/python -m unittest discover -s simulator -p 'test_hardware_reservation.py'
```

For the actual backend/broker (after restart), run the live temporary-fixture test from `backend/`:

```sh
./node_modules/.bin/tsx ../firmware/tests/integration.ts
```

It creates clearly named temporary records, validates transport including hardware-labelled null-only test readings, then removes only those records. It is a software transport test, not a measurement from sensors. The test supports `TEST_API_URL` and `MQTT_BROKER_URL` overrides. `install-dependencies.sh` installs pinned dependencies for an existing Arduino CLI; `SENTINELX_ARDUINO`, `SENTINELX_FQBN` and `SENTINELX_LIBRARIES` can override local paths/target. Arduino IDE instructions are in QUICKSTART.

## Verification results

| Check | Result |
|---|---|
| Full classic ESP32 compile, supplied guards disabled | PASS — 387,160 bytes flash; 31,692 bytes globals |
| Full compile with hardware/network/gas/motion enabled in a separate test copy | PASS — 989,929 bytes flash; 58,500 bytes globals |
| Firmware JSON builders against real backend Zod schemas | PASS — populated/null readings and immediate alert |
| Sensor/outbox state tests with ASan + UBSan | PASS — contact loss, saturation, PPG windows, fall timing/gaps/rollover, warmup/ADC conversion, outbox restore/identity/capacity/duplicate ACK |
| Backend tests | 41/41 PASS |
| Backend TypeScript build | PASS |
| Frontend TypeScript + production build | PASS; existing large-bundle warning remains |
| Frontend source rendering/live-state checks | PASS — false/true/null/absent, mixed workers, no connectivity inference |
| Simulator reservation tests | 3/3 PASS |
| Live MQTT → backend → PostgreSQL → REST/Socket.IO | PASS on isolated localhost broker1884/backend5002 |
| Persistence ACK/replay and source separation | PASS; repeated events deduplicate, conflicting source rejected, acknowledged hazard grouped |
| Offline watchdog | PASS |
| Temporary fixture cleanup | Verified zero test workers/helmets/readings/incidents/receipts |
| Upload, physical sensors, actual Wi-Fi, buzzer, real NVS power-loss | NOT RUN — hardware is with the user's friend |

Physical wiring, calibration, contact quality, thresholds and field reliability remain unverified. No prepared binary is supplied for blind flashing; the friend must compile with the real board/configuration. Follow QUICKSTART and record actual results before calling the hardware integration verified.

## Electrical and sensing constraints

- ESP32 GPIO is 3.3V logic. GPIO34 is input-only and lacks internal pull-ups.
  ADC1 is used because classic ESP32 ADC2 conflicts with Wi-Fi.
- The MQ-5 heater requires a suitable 5V supply, not an ESP32 GPIO or its 3.3V rail.
  Winsen specifies up to 950mW heater consumption. Share ground with the ESP32.
  Never connect a possible 5V analog output directly to the ADC. For example,
  two equal 20kΩ resistors divide 5V to 2.5V; verify actual module output, resistor
  tolerances, grounding and maximum ADC-node voltage before connection. Attenuation
  settings do not provide overvoltage protection.
- MQ-5 first-use conditioning is not the firmware's 3-minute settling timer.
  Winsen specifies at least 48 hours preheating under its standard test conditions;
  follow your module's documentation and establish a stable baseline. Keep
  `GAS_CONDITIONING_CONFIRMED=false` until conditioning and wiring are verified.
  Until then `gasRaw` is null. The 12-bit ADC is scaled to the existing 0–1023
  contract; this does not calibrate concentration or validate existing thresholds.
  MQ-5 targets flammable gases such as LPG/methane; it is not a general toxic-gas meter.
- Ensure I2C/DHT pull-ups are to 3.3V; verify breakout power/level shifting against
  the actual module. Raw MAX30102 silicon and breakout boards differ in power needs.
- MAX30102 needs stable optical skin contact and appropriate mounting. A sensor
  inside a helmet with no skin contact cannot produce meaningful pulse/SpO2.
  Missing contact, saturated samples, sampling gaps or invalid algorithm results
  produce null. The adjustable IR threshold is experimental, not a complete signal
  quality test. This implementation makes no medical accuracy claim.
- Fall and inactivity algorithms are experimental and disabled by default. Enable
  only for controlled bench evaluation. Fall logic requires low-g, impact and
  stillness; it can miss real falls or flag dropped equipment. Do not test by making
  a person fall. Missing IMU is printed on serial; the current backend boolean
  motion contract cannot represent an unknown motion state.
- This is a bench prototype, not a certified life-safety system or intrinsically
  safe equipment for an explosive mine atmosphere.


## Primary references

- [Arduino CLI installation](https://docs.arduino.cc/arduino-cli/installation/)
- [Espressif Arduino board installation](https://docs.espressif.com/projects/arduino-esp32/en/latest/installing.html)
- [Espressif official download mirror](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-guides/tools/idf-tools.html)
- [ESP32 GPIO restrictions](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/peripherals/gpio.html)
- [Winsen MQ-5 specifications](https://www.winsen-sensor.com/product/mq-5.html)
- [SparkFun reference SpO2 example](https://github.com/sparkfun/SparkFun_MAX3010x_Sensor_Library/blob/master/examples/Example8_SPO2/Example8_SPO2.ino)
- [PubSubClient limitations](https://github.com/knolleary/pubsubclient)

- [Arduino ctags source](https://github.com/arduino/ctags/tree/5.8-arduino11)
