# SentinelX REST API & Socket.IO Specification

## 1. REST Endpoints (Base URL: `http://localhost:5001/api`)

### 1.1 Workers
- `GET /workers`
  - Returns array of all workers with linked helmet, connectivity state, latest sensor reading, and active incident flags.
- `GET /workers/:id`
  - Returns individual worker profile, assigned zone, helmet details, and recent 10 incidents.
- `GET /workers/:id/latest`
  - Returns the single most recent `SensorReading` recorded for this worker.
- `GET /workers/:id/history?limit=50`
  - Returns chronologically sorted historical sensor readings formatted for charting.

### 1.2 Incidents
- `GET /incidents`
  - Query parameters: `workerId`, `severity`, `status`, `incidentType`.
  - Returns array of incidents sorted by `detectedAt DESC`.
- `GET /incidents/active`
  - Returns all unaddressed incidents (`status` in `['ACTIVE', 'ACKNOWLEDGED']`).
- `PATCH /incidents/:id/acknowledge`
  - Body: `{"acknowledgedBy": "Control Room Supervisor"}`
  - Updates incident `status` to `ACKNOWLEDGED`, sets `acknowledgedAt` timestamp.
- `PATCH /incidents/:id/resolve`
  - Updates incident `status` to `RESOLVED`, sets `resolvedAt` timestamp.

### 1.3 Helmets & System
- `GET /helmets/status`
  - Returns all helmets with current connectivity status (`ONLINE` / `OFFLINE`) and `lastSeen` timestamp.
- `GET /health`
  - System health check returning status, timestamp, and simulated mode confirmation.

---

## 2. Real-Time Socket.IO Events

The Socket.IO server operates on port `5001`.

| Event Name | Direction | Payload | Description |
|---|---|---|---|
| `telemetry:new` | Server &rarr; Client | `LiveTelemetryEvent` | Emitted every time valid telemetry arrives over MQTT. Includes sensor readings and evaluated `riskLevel`. |
| `incident:new` | Server &rarr; Client | `Incident` | Emitted when an emergency condition (Fall, SOS, Gas surge, Hypoxia) triggers a new incident. |
| `incident:updated` | Server &rarr; Client | `Incident` | Emitted when an incident is acknowledged or resolved by an operator. |
| `helmet:status` | Server &rarr; Client | `{ helmetId, status, lastSeen }` | Emitted when a helmet transitions between `ONLINE` and `OFFLINE`. |
