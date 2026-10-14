# SentinelX — Intelligent IoT Safety & Emergency Response System for Industrial Workers

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React_18-20232A?style=flat&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=flat&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Mosquitto](https://img.shields.io/badge/Mosquitto_MQTT-373737?style=flat&logo=eclipsemosquitto&logoColor=white)](https://mosquitto.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

**SentinelX** is a prototype IoT worker safety monitoring and rapid emergency response platform designed for high-risk industrial environments such as deep open-pit mines, processing plants, and underground construction tunnels.

The system emulates wearable smart safety helmets equipped with multimodal sensors, streams telemetry over MQTT, analyzes vitals and environmental metrics against multi-tier safety rules, alerts control room supervisors via WebSocket pushes, and maintains auditable incident records in PostgreSQL.

---

## 🏛️ Architectural Overview & Key Decisions

As a third-year engineering prototype designed to scale to physical hardware, SentinelX follows key industrial software design principles:

```
[Python ESP32 Simulator] ──(MQTT QoS 1)──> [Eclipse Mosquitto (1883)]
                                                   │
                                                   ▼
                                        [Node.js / Express Core]
                                          ├─ Zod Schema Validation
                                          ├─ Rule & Severity Engine
                                          ├─ Deduplication Engine
                                          ├─ 10s Heartbeat Watchdog
                                          ▼                        ▼
                              [PostgreSQL (Prisma)]       [Socket.IO Server]
                                          ▲                        │
                                          │ (REST APIs)            │ (WebSockets)
                                          └────────────┬───────────┘
                                                       ▼
                                            [React Dashboard UI]
```

### Why This Architecture?
1. **Hardware-Decoupled MQTT Pipeline:**
   Instead of tying the backend directly to simulated data, telemetry flows through a real **Mosquitto MQTT broker** using the exact topic structure (`sentinelx/{helmetId}/telemetry`) and JSON format planned for the future physical ESP32 firmware. When the hardware is ready, you flash the ESP32 code and change zero backend lines!
2. **Deterministic Rule Engine (No Black-Box ML for Immediate Hazards):**
   Fall impacts and toxic gas surges require immediate, predictable classification (`NORMAL`, `WARNING`, `HIGH_RISK`, `CRITICAL`).
3. **Heartbeat Watchdog with Inactivity Detection:**
   If a worker's helmet loses signal (or the worker enters a dead-zone), the backend detects the absence of pings within **10 seconds** and updates their status to `OFFLINE`.
4. **Active Incident Deduplication:**
   When an elevated gas reading persists across 50 consecutive telemetry ticks, SentinelX logs the readings to the time-series history without spamming 50 duplicate alerts in the incident log.

---

## 🔬 Hardware Sensors Emulated

| Hardware Module | Measured Metric | Demonstration Safe Range | Hazard Trigger |
|---|---|---|---|
| **MPU6050** (IMU) | Impact acceleration & motion | Freefall = false | High-G deceleration &gt; 4.0G (`FALL_DETECTED`) |
| **MAX30102** (PPG) | Heart Rate & Blood Oxygen (SpO₂) | HR: 60–100 bpm, SpO₂: 95–100% | SpO₂ &lt; 92% (Hypoxia), HR &gt; 125 or &lt; 50 bpm |
| **MQ-5** (Gas Sensor) | Analog gas resistance (ADC 0–1023) | Baseline: 120–250 | Raw &gt; 650 (High Risk), Raw &gt; 850 (Critical) |
| **DHT11** (Temp/Humidity) | Ambient Temperature & Humidity | Temp: 20–30°C, Humidity: 40–60% | Temp &gt; 38°C (Heat Stress) |
| **Push Button** | Emergency SOS panic distress | Released | Depressed (`SOS_TRIGGERED`) |

> [!NOTE]
> **Prototype Threshold Notice:** All raw analog gas values (MQ-5 ADC units) and biometric thresholds are experimental prototypes intended for functional software demonstration. They are not calibrated medical or industrial parts-per-million certifications.

---

## ⚡ Quick Start Guide

### Prerequisites
- macOS Apple Silicon (M1/M2/M3)
- Node.js `v20+` & npm
- Python `3.10+`
- Homebrew (`postgresql@16` and `mosquitto`)

### 1. Start Background Infrastructure
Ensure PostgreSQL and Mosquitto are running:
```bash
brew services start postgresql@16
brew services start mosquitto
```

### 2. Start the Backend Service
```bash
cd sentinelx/backend
npm install
npm run prisma:seed   # Seeds 3 workers: W-101, W-102, W-103
npm run dev           # Starts REST & Socket.IO server on http://localhost:5001
```

### 3. Start the React Dashboard
```bash
cd sentinelx/frontend
npm install
npm run dev           # Starts UI on http://localhost:5173 or 5174
```

### 4. Launch the Interactive Python Simulator
```bash
cd sentinelx/simulator
source venv/bin/activate
python simulator.py
```

---

## 🎮 Simulator Menu & The 7 Scenarios

When you run `python simulator.py`, an interactive CLI menu is presented:

```
========================================================================
   SENTINELX: ESP32 WEARABLE SAFETY SENSOR SIMULATOR (CLI)
   [SIMULATION MODE: ALL SENSOR DATA AND METRICS ARE SYNTHETIC]
========================================================================

Active Workers:
 [1] Alex Carter     (Worker: W-101, Helmet: H-201) | Zone A - Extraction Pit
 [2] Marcus Vance    (Worker: W-102, Helmet: H-202) | Zone B - Shaft 3
 [3] Elena Rostova   (Worker: W-103, Helmet: H-203) | Zone C - Processing Plant

Interactive Scenarios:
  [1] Normal Continuous Telemetry (All Workers Baseline)
  [2] Fall Detection Emergency (Trigger fall on worker)
  [3] Gas Hazard Surge (MQ-5 analog cross threshold)
  [4] Abnormal Health Event (Hypoxia or Tachycardia)
  [5] SOS Panic Button Trigger (Worker manually activates emergency)
  [6] Helmet Disconnect / Offline (Halt worker telemetry stream)
  [7] Multi-Worker Emergency Cascade (Multiple simultaneous hazards)
  [8] Reconnect / Reset Specific Worker
  [9] Reset All Workers to Normal
  [0] Exit Simulator
```

Select any scenario (e.g., press `2` and pick Worker 1) and watch the React dashboard update in real-time with zero latency!

---

## 🧪 Automated Testing

### 1. Backend Unit Tests (Vitest)
Verifies rule engine thresholds and deduplication cache:
```bash
cd sentinelx/backend
npm test
```

### 2. Full 13-Step End-to-End Acceptance Test
Runs the complete acceptance test workflow programmatically:
```bash
cd sentinelx
./simulator/venv/bin/python scripts/acceptance_test.py
```

**Workflow Verified:**
1. Infrastructure check (PostgreSQL + Mosquitto)
2. Backend REST API health
3. Frontend Vite accessibility
4. Normal telemetry publication for 3 workers
5. Database persistence and helmet `ONLINE` state transition
6. Fall detection emergency trigger on `W-101`
7. Critical incident creation in PostgreSQL
8. Worker profile alert state update
9. REST incident acknowledgment (`status='ACKNOWLEDGED'`)
10. Database persistence of acknowledgment timestamp and operator name
11. Telemetry halt for `H-202`
12. 10-second heartbeat timeout marking helmet `OFFLINE`
13. Reconnection packet restoring helmet to `ONLINE`
14. Final incident resolution lifecycle

---

## 📁 Repository Structure

```
sentinelx/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma        # Database models & relationships
│   │   └── seed.ts              # Initial seed data (3 workers & helmets)
│   ├── src/
│   │   ├── config/              # Threshold configurations & DB client
│   │   ├── controllers/         # Worker, reading, incident, helmet controllers
│   │   ├── mqtt/                # Mosquitto subscriber & message handlers
│   │   ├── routes/              # Express API endpoints
│   │   ├── services/            # RuleEngine, HeartbeatWatchdog, IncidentService
│   │   ├── socket/              # Socket.IO WebSocket emitter
│   │   ├── types/               # TypeScript interfaces & Zod schemas
│   │   └── app.ts               # Server entry point
│   └── tests/                   # Vitest unit test suite
│
├── frontend/
│   ├── src/
│   │   ├── components/          # Reusable Navbar, SeverityBadge, EmergencyBanner
│   │   ├── context/             # Global real-time SafetyContext
│   │   ├── pages/
│   │   │   ├── OverviewPage.tsx         # Page 1: High-level KPI & status matrix
│   │   │   ├── LiveMonitoringPage.tsx   # Page 2: Live telemetry cards
│   │   │   ├── WorkerDetailsPage.tsx    # Page 3: Recharts historical graphs
│   │   │   ├── EmergencyPage.tsx        # Page 4: Active emergency triage (Ack/Resolve)
│   │   │   └── IncidentHistoryPage.tsx  # Page 5: Filterable incident audit trail
│   │   ├── services/            # Fetch REST client & Socket.IO client
│   │   └── App.tsx
│   ├── tailwind.config.js       # Industrial dark navy & teal palette
│   └── vite.config.ts
│
├── simulator/
│   ├── config.py                # Simulated workers, MQTT topics
│   ├── worker_simulator.py      # Individual worker state machine
│   ├── scenarios.py             # 7 hazard scenario implementations
│   └── simulator.py             # Interactive CLI simulator menu
│
├── scripts/
│   └── acceptance_test.py       # Automated 13-step acceptance test runner
│
└── docs/
    ├── architecture.md          # Complete Mermaid system architecture
    ├── mqtt_spec.md             # Topic formats & JSON schemas
    └── api_spec.md              # REST endpoints & Socket.IO events
```

---

## 🛠️ Troubleshooting Guide

- **`EADDRINUSE: address already in use :::5000`:**
  macOS uses port 5000 for the AirPlay Receiver. SentinelX backend defaults to port `5001` to prevent conflicts.
- **Mosquitto Connection Refused:**
  Ensure Mosquitto is running with `brew services info mosquitto`. Check `mosquitto.conf` has `listener 1883` and `allow_anonymous true`.
- **PostgreSQL Connection Error:**
  Verify PostgreSQL service status: `brew services info postgresql@16`. Test connectivity using `psql -d sentinelx_db`.
- **Socket Disconnected in UI:**
  Confirm backend is running on `http://localhost:5001`. The top bar will display a flashing red `DISCONNECTED` indicator if backend is stopped.

---

## 🚀 Future Hardware Extensions
- **ESP32 Firmware Flash:** Map GPIO pins for MAX30102 (I2C `SDA/SCL`), MPU6050 (I2C), MQ-5 (ADC pin 34), DHT11 (GPIO 4), and SOS push button (GPIO 15).
- **LoRa Fallback:** For deep underground tunnels where WiFi is unavailable, integrate SX1278 LoRa transceivers with gateway forwarding to the MQTT broker.
- **Multi-Worker Hazard Correlation:** Correlate proximity data to flag area-wide gas releases or structural collapses.
# SentinelX
