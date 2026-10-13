# SentinelX System Architecture Documentation

## 1. System Overview
**SentinelX** is an IoT-enabled industrial worker safety and emergency response platform tailored for hazardous environments such as mining pits, deep underground shafts, and heavy construction sites.

The software architecture is decoupled into four modular layers:
1. **Wearable Sensor Emulation Layer (Edge):** Emulates physical smart helmets (ESP32 + MAX30102 + MQ-5 + DHT11 + MPU6050 + SOS) via Python over MQTT.
2. **Ingestion & Messaging Broker:** Eclipse Mosquitto broker mediating publish/subscribe communication on dedicated topics.
3. **Application & Rule Engine Backend:** Node.js/TypeScript Express server executing schema validation, a deterministic rule & severity classification engine, duplicate prevention, a 10-second heartbeat offline detection watchdog, and Socket.IO broadcast.
4. **Supervisory Dashboard (Frontend):** Modern React (Vite + Tailwind CSS + Recharts) dark-themed interface delivering real-time telemetry gauges, interactive emergency triage, historical analytics, and audit filtering.

---

## 2. Architecture Diagram (Mermaid)

```mermaid
flowchart TD
    subgraph "Edge / Simulation Layer"
        W1["ESP32 Helmet H-201<br/>Alex Carter (Zone A)"]
        W2["ESP32 Helmet H-202<br/>Marcus Vance (Zone B)"]
        W3["ESP32 Helmet H-203<br/>Elena Rostova (Zone C)"]
    end

    subgraph "MQTT Messaging Broker"
        BROKER["Eclipse Mosquitto Broker<br/>Port 1883"]
    end

    subgraph "Backend Core (Node.js + Express + TypeScript)"
        SUB["MQTT Subscriber<br/>sentinelx/+/telemetry<br/>sentinelx/+/alert"]
        RE["Rule & Severity Engine<br/>NORMAL | WARNING | HIGH_RISK | CRITICAL"]
        DEDUP["Incident & Deduplication Engine"]
        HB["Heartbeat Watchdog (10s Timeout)"]
        PRISMA["Prisma ORM Client"]
        REST["Express REST API (Port 5001)"]
        SIO["Socket.IO Server (WebSockets)"]
    end

    subgraph "Storage Layer"
        DB[("PostgreSQL Database<br/>sentinelx_db")]
    end

    subgraph "Supervisory Web Dashboard (React + Vite + Tailwind)"
        UI_NAV["Navigation & Status Bar<br/>[SIMULATION MODE BADGE]"]
        UI_OVR["Overview Matrix"]
        UI_LIVE["Live Worker Monitoring"]
        UI_DET["Worker Details & Charts"]
        UI_EMG["Emergency Triage (Ack / Resolve)"]
        UI_HIST["Incident Audit History"]
    end

    W1 & W2 & W3 -->|"QoS 0/1 MQTT Publish"| BROKER
    BROKER -->|"Topic Ingestion"| SUB
    SUB --> RE
    SUB --> HB
    RE --> DEDUP
    DEDUP --> PRISMA
    HB --> PRISMA
    PRISMA <--> DB
    REST <--> PRISMA
    RE -->|"telemetry:new / incident:new"| SIO
    HB -->|"helmet:status (ONLINE/OFFLINE)"| SIO
    SIO -->|"Real-Time Push"| UI_LIVE & UI_OVR & UI_EMG
    REST <-->|"HTTP Initial Data / Actions"| UI_OVR & UI_DET & UI_EMG & UI_HIST
```

---

## 3. Communication Sequences

### Telemetry Pipeline
1. Simulated Helmet generates JSON payload with biometric (HR, SpO₂), environmental (Gas Raw, Temp, Humidity), and kinematic (Fall, Inactivity) metrics.
2. Packet is published to `sentinelx/{helmetId}/telemetry`.
3. Mosquitto forwards packet to Node.js backend.
4. Backend parses and validates JSON via Zod schema.
5. `HeartbeatService.recordPing()` updates helmet `lastSeen` timestamp and marks status `ONLINE`.
6. Reading is written to `SensorReading` table in PostgreSQL via Prisma.
7. `RuleEngineService` tests readings against safety thresholds.
8. If hazards exceed thresholds, an active incident is created (subject to deduplication).
9. Socket.IO broadcasts `telemetry:new` to connected dashboards.

### Emergency Alert & Response Sequence
```mermaid
sequenceDiagram
    autonumber
    actor Worker as Worker Helmet (H-201)
    participant Broker as Mosquitto MQTT
    participant Backend as Express/Node.js
    participant DB as PostgreSQL
    participant Dashboard as React Dashboard
    actor Supervisor as Control Room Supervisor

    Worker->>Broker: PUB sentinelx/H-201/alert (FALL_DETECTED, CRITICAL)
    Broker->>Backend: MQTT Msg Dispatch
    Backend->>DB: INSERT into incidents (status=ACTIVE, severity=CRITICAL)
    Backend->>Dashboard: Socket.IO emit 'incident:new'
    Note over Dashboard: Flashing Red Banner & Audio Alert
    Supervisor->>Dashboard: Click "ACKNOWLEDGE"
    Dashboard->>Backend: PATCH /api/incidents/:id/acknowledge
    Backend->>DB: UPDATE incidents SET status='ACKNOWLEDGED', ack_by='Supervisor'
    Backend->>Dashboard: Socket.IO emit 'incident:updated'
    Supervisor->>Dashboard: Click "RESOLVE INCIDENT"
    Dashboard->>Backend: PATCH /api/incidents/:id/resolve
    Backend->>DB: UPDATE incidents SET status='RESOLVED', resolved_at=NOW()
    Backend->>Dashboard: Socket.IO emit 'incident:updated'
```
