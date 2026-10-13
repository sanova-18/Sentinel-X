# SentinelX MQTT Message & Topic Specifications

## 1. Overview
The communication between smart safety helmets (or the Python simulator) and the SentinelX backend utilizes standard MQTT v3.1.1 / v5.0 protocols.

- **Default Broker Host:** `localhost` / `127.0.0.1`
- **Default Port:** `1883`
- **Security / Auth:** Configurable anonymous access for local development; supports TLS and client authentication tokens in production.

---

## 2. Topic Architecture

| Topic Pattern | QoS | Publisher | Subscriber | Purpose |
|---|---|---|---|---|
| `sentinelx/{helmetId}/telemetry` | `0` or `1` | Wearable Helmet | Backend | Periodic sensor data stream (heart rate, SpO₂, gas raw, temp, humidity, motion) every 2-3s. |
| `sentinelx/{helmetId}/alert` | `1` | Wearable Helmet | Backend | Event-driven emergency notifications (Fall, SOS trigger, extreme hazard). |

---

## 3. Payload Schemas

### 3.1 Telemetry Payload (`sentinelx/{helmetId}/telemetry`)
```json
{
  "messageId": "msg_98451842-1201",
  "helmetId": "H-201",
  "workerId": "W-101",
  "timestamp": "2026-10-13T14:32:00.123Z",
  "vitals": {
    "heartRate": 76.5,
    "spo2": 98.2
  },
  "environment": {
    "temperature": 27.4,
    "humidity": 52.1,
    "gasRaw": 185
  },
  "motion": {
    "fallDetected": false,
    "inactivityDetected": false
  },
  "isSimulated": true
}
```

#### Field Specifications:
- `messageId` *(string, optional)*: Unique identifier for packet tracing.
- `helmetId` *(string, required)*: Hardware helmet identifier (e.g., `H-201`).
- `workerId` *(string, required)*: Personnel identifier (e.g., `W-101`).
- `timestamp` *(ISO 8601 string, required)*: Reading capture time.
- `vitals.heartRate` *(number, null allowed)*: Beats per minute from MAX30102.
- `vitals.spo2` *(number, null allowed)*: Blood oxygen percentage (90-100%).
- `environment.temperature` *(number, null allowed)*: Ambient degrees Celsius from DHT11.
- `environment.humidity` *(number, null allowed)*: Relative humidity percentage from DHT11.
- `environment.gasRaw` *(integer, null allowed)*: Raw analog ADC reading from MQ-5 (0–1023). **Notice: Uncalibrated raw analog value for prototype demonstration only.**
- `motion.fallDetected` *(boolean)*: True if high-G impact followed by lack of orientation change occurred.
- `motion.inactivityDetected` *(boolean)*: True if lack of motion exceeded configured window.
- `isSimulated` *(boolean)*: Always true for synthetic data.

---

### 3.2 Immediate Alert Payload (`sentinelx/{helmetId}/alert`)
```json
{
  "eventId": "evt_fall_82910382",
  "helmetId": "H-201",
  "workerId": "W-101",
  "timestamp": "2026-10-13T14:32:05.456Z",
  "alertType": "FALL_DETECTED",
  "severity": "CRITICAL",
  "description": "Sudden deceleration and lack of motion detected on helmet H-201",
  "sensorData": {
    "heartRate": 110.0,
    "spo2": 97.0,
    "fallDetected": true
  },
  "isSimulated": true
}
```

#### Field Specifications:
- `eventId` *(string, required)*: Unique identifier used by the deduplication engine to ignore retransmitted packets.
- `alertType` *(string, required)*: `FALL_DETECTED`, `SOS_TRIGGERED`, `GAS_LEAK_WARNING`, `TACHYCARDIA`, etc.
- `severity` *(enum, required)*: `NORMAL`, `WARNING`, `HIGH_RISK`, `CRITICAL`.
- `description` *(string, required)*: Human-readable alert summary for supervisory display.
