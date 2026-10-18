# SentinelX: friend’s ESP32 setup guide

Use this guide with the complete `sentinelx_esp32` sketch folder, including its `.ino` and all `.h` files. The intended hardware is one ESP32, MAX30102 heart-rate sensor, DHT11 temperature/humidity sensor, MQ-5 gas sensor, MPU6050 motion sensor and a buzzer. No SOS button or separate LED is required.

The actual board model, wiring and buzzer type still need confirmation. Software checks do not establish that your hardware works: the ESP32 has not been uploaded or physically tested as part of this handoff.

## 1. Install the Arduino tools on the computer connected to the ESP32

1. Install [Arduino IDE](https://www.arduino.cc/en/software/).
2. In Arduino IDE Settings/Preferences, add this to **Additional Boards Manager URLs**:
   `https://espressif.github.io/arduino-esp32/package_esp32_index.json`
3. Open Boards Manager, find **esp32 by Espressif Systems**, and install **3.3.12**. This downloads the board tools as well as the core; allow the download and installation to finish.
4. Open Library Manager and install these versions. Accept required library dependencies.

| Library Manager name | Version |
|---|---|
| Adafruit MPU6050 | 2.2.9 |
| Adafruit Unified Sensor | 1.1.15 |
| Adafruit BusIO | 1.17.4 |
| SparkFun MAX3010x Pulse and Proximity Sensor Library | 1.1.2 |
| DHT sensor library | 1.4.7 |
| PubSubClient | 2.8 |
| ArduinoJson | 7.4.3 |

Use the SparkFun MAX3010x library above: it includes `spo2_algorithm.h` and its implementation. Do not substitute an unrelated MAX30102 library.

## 2. Verify the board and wiring before enabling the sketch

Read the label on the board/module and record its model. This sketch currently targets the **classic ESP32-WROOM/DevKit**. Its pin layout must not be copied unchanged onto an ESP32-C3, S2 or S3; those need a board-specific adaptation.

The following are proposed defaults, **not confirmed existing wiring**:

| Connection | Proposed classic ESP32 GPIO |
|---|---|
| MPU6050 + MAX30102 shared SDA | 21 |
| MPU6050 + MAX30102 shared SCL | 22 |
| MPU6050 I²C address | 0x68; 0x69 if AD0 is high |
| MAX30102 I²C address | 0x57 |
| DHT11 data | 4 |
| MQ-5 conditioned analog output | 34, ADC1 |
| Buzzer control | 25 |
| SOS / separate LED | Disabled: -1 / -1 |

Check these electrical details with power disconnected:

- ESP32 GPIO uses 3.3V logic. Verify breakout power requirements and that I²C/DHT pull-ups go to 3.3V.
- Power the MQ-5 heater from a suitable 5V supply and share ground with the ESP32. **Never connect a possible 5V MQ-5 analog output directly to the ESP32 ADC.** Use a verified divider/conditioning circuit and measure the highest ADC-node voltage before connecting it. ADC attenuation is not voltage protection.
- Confirm whether the buzzer is active or passive and its voltage/current requirements. Use a suitable driver/transistor where required; the ESP32 control pin must not be used as a high-current supply.
- GPIO34 is input-only and has no internal pull-up. Avoid repurposing boot/flash pins on the classic ESP32.

## 3. Make your local configuration

Open `sentinelx_esp32.ino` in Arduino IDE. Copy `config.example.h` to **`config.h` in the same sketch folder**. Keep Wi-Fi passwords in this local file; do not publish or share the completed file.

Set the verified GPIOs and buzzer settings in `config.h`. For the first sensor-only check:

```cpp
constexpr bool HARDWARE_CONFIRMED = true; // ONLY after board and wiring checks
constexpr bool NETWORK_ENABLED = false;
constexpr bool GAS_CONDITIONING_CONFIRMED = false;
constexpr bool ENABLE_EXPERIMENTAL_FALL = false;
constexpr bool ENABLE_EXPERIMENTAL_INACTIVITY = false;
constexpr int SOS_PIN = -1, LED_PIN = -1;
```

`HARDWARE_CONFIRMED` is **false in the supplied template**. If it remains false, the sketch intentionally skips hardware initialization. Change the existing definitions; do not add duplicate lines.

Set `BUZZER_IS_PASSIVE` to match the actual buzzer and confirm `BUZZER_ACTIVE_HIGH`. Keep both experimental motion options off during initial integration.

## 4. Compile, upload and check sensors over USB first

1. Connect the ESP32 with a **data-capable USB cable**.
2. Select the verified board under Tools → Board. For a confirmed generic classic ESP32-WROOM DevKit, **ESP32 Dev Module** is the usual target. Select the actual USB serial port under Tools → Port.
3. Click **Verify**. Resolve any compilation errors before uploading.
4. Click **Upload**. If the board requires a manual bootloader step, follow that board’s upload instructions. Do not select a Bluetooth/debug port as the ESP32 port.
5. Open Serial Monitor at **115200 baud**. Reset the board if needed to see startup output.
6. Check MPU6050 and MAX30102 presence, DHT11 readings, and the ongoing sensor output. Missing or invalid readings must remain unavailable; do not substitute invented normal values.

For the MAX30102, use steady optical skin contact and allow time for a reading window. No skin contact should produce unavailable heart rate/SpO₂. These readings are experimental and **not medically validated**.

The MQ-5 value stays unavailable while `GAS_CONDITIONING_CONFIRMED=false`. Complete the sensor manufacturer’s initial conditioning, verify the analog voltage and establish a baseline before changing it to true. The short firmware warm-up timer does not replace initial conditioning. The published gas value is a scaled raw ADC reading, not ppm or a calibrated concentration.

Do not test falls by making a person fall. Any later enabling/tuning of fall or inactivity detection is a controlled bench task. This hardware is a prototype and is not suitable for deployment into an explosive mine atmosphere.

## 5. Arrange the connection to Varun’s Mac

The ESP32 needs a compatible **2.4GHz Wi-Fi network** and a route to the Mac running Mosquitto and the SentinelX backend. Both devices can be on the same reachable LAN; router guest/client isolation must not block them. If you and the Mac are in different locations, arrange a routable private network first. Entering the Mac’s private LAN address from an unrelated network will not connect them.

Ask Varun for the Mac’s **current reachable LAN/private address**. The address present in `config.example.h` is an old setup value and may have changed. Do not use `localhost` or `127.0.0.1` as `MQTT_HOST` on the ESP32.

Fill in the existing configuration entries:

```cpp
constexpr char WIFI_SSID[] = "YOUR_2_4_GHZ_WIFI";
constexpr char WIFI_PASSWORD[] = "YOUR_WIFI_PASSWORD";
constexpr char MQTT_HOST[] = "CURRENT_REACHABLE_MAC_ADDRESS";
constexpr uint16_t MQTT_PORT = 1883;
constexpr char HELMET_ID[] = "H-201";
constexpr char WORKER_ID[] = "W-101";
```

Use that worker/helmet pair only after Varun confirms it is assigned and reserved in the existing database. If MQTT authentication is configured, fill `MQTT_USER` and `MQTT_PASSWORD` locally. The current bench connection uses plaintext MQTT; use an appropriate protected network.

Varun must have Mosquitto, PostgreSQL, the updated backend and dashboard running. The backend’s additive source/receipt database update must be applied before testing durable acknowledgements. Do not reset or reseed the working database.

## 6. Reserve the hardware identity and enable networking

Before the ESP32 sends data, stop any already-running simulator instance that sends H-201. On the Mac, restart the simulator from the project root with:

```sh
simulator/venv/bin/python simulator/simulator.py --exclude-helmet H-201
```

This reserves H-201 for the physical board even when simulator scenarios are changed. Other simulator helmets can continue. Do not run another simulator instance without the exclusion for this helmet.

Set `NETWORK_ENABLED=true`, compile and upload again. Watch Serial Monitor for Wi-Fi/MQTT connection and time synchronization. Network credentials and a reachable broker are required. The firmware waits for valid time before sending timestamped messages, so an unsynchronized clock can explain a connected device with no dashboard readings.

## 7. Confirm the full path with Varun

Check in this order:

1. Serial shows sensible readings and sensor availability.
2. The board connects to MQTT and sends `sentinelx/H-201/telemetry`.
3. The backend saves the readings and updates W-101/H-201 in the dashboard.
4. New physical readings show **Hardware**. Simulator readings show **Simulated**; old or unlabelled records remain **Unknown**. This source label is declared by the sender, not proof of measurement accuracy.
5. During an agreed controlled bench alert test, verify the local buzzer and a persisted backend incident. Do not use unsafe gas exposure or a person falling to trigger it.

The firmware keeps explicit fall events (and optional SOS events, if later wired) in a durable local outbox and retries the same event ID until the backend confirms persistence. The confirmation is a non-retained MQTT message on:

```text
sentinelx/H-201/ack
```

Its JSON must match the event’s helmet, worker and event ID and contain `"status":"persisted"`. An MQTT connection or successful publish alone does not mean the incident reached the database. The backend stores a durable receipt so replaying the same event after reconnect or restart does not create another incident for that event. The outbox holds eight events; check serial warnings during extended outages. Gas/vitals/temperature alerts currently come from live telemetry rules and the local buzzer; their offline history is not stored in this outbox. Drain pending alerts before changing worker/helmet assignments: the backend rejects messages from an old assignment.

As controlled bench checks, disconnect/reconnect Wi-Fi, remove/reapply optical contact, and reboot with a queued test alert. Confirm reconnect, unavailable sensor values, outbox retry and acknowledgement. Resetting a local buzzer latch with `r` in Serial Monitor does not resolve a dashboard incident or discard queued alerts.

## What to send back

Send the exact board model, actual GPIO map, buzzer type, compile/upload result, sensor startup messages and any error text. Record which sensor, network, dashboard and reconnection checks actually passed. Until those checks are performed on this board, describe it as prepared firmware awaiting hardware verification.
