import os

BROKER_HOST = os.getenv("MQTT_HOST", "127.0.0.1")
BROKER_PORT = int(os.getenv("MQTT_PORT", "1883"))

TELEMETRY_TOPIC_TEMPLATE = "sentinelx/{helmet_id}/telemetry"
ALERT_TOPIC_TEMPLATE = "sentinelx/{helmet_id}/alert"

SIMULATED_WORKERS = [
    {
        "worker_id": "W-101",
        "name": "Alex Carter",
        "helmet_id": "H-201",
        "assigned_zone": "Zone A - Extraction Pit",
        "base_hr": 75.0,
        "base_spo2": 98.5,
        "base_temp": 26.5,
        "base_humidity": 50.0,
        "base_gas_raw": 180,
    },
    {
        "worker_id": "W-102",
        "name": "Marcus Vance",
        "helmet_id": "H-202",
        "assigned_zone": "Zone B - Shaft 3",
        "base_hr": 78.0,
        "base_spo2": 98.0,
        "base_temp": 28.0,
        "base_humidity": 55.0,
        "base_gas_raw": 210,
    },
    {
        "worker_id": "W-103",
        "name": "Elena Rostova",
        "helmet_id": "H-203",
        "assigned_zone": "Zone C - Processing Plant",
        "base_hr": 72.0,
        "base_spo2": 99.0,
        "base_temp": 25.5,
        "base_humidity": 48.0,
        "base_gas_raw": 160,
    },
]
