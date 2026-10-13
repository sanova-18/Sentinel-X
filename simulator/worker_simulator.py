import random
import uuid
from datetime import datetime, timezone

class WorkerSimulator:
    def __init__(self, config_dict):
        self.worker_id = config_dict["worker_id"]
        self.name = config_dict["name"]
        self.helmet_id = config_dict["helmet_id"]
        self.assigned_zone = config_dict["assigned_zone"]

        self.base_hr = config_dict["base_hr"]
        self.base_spo2 = config_dict["base_spo2"]
        self.base_temp = config_dict["base_temp"]
        self.base_humidity = config_dict["base_humidity"]
        self.base_gas_raw = config_dict["base_gas_raw"]

        # Current state
        self.is_online = True
        self.fall_detected = False
        self.inactivity_detected = False
        self.override_gas_raw = None
        self.override_hr = None
        self.override_spo2 = None
        self.override_temp = None

    def reset_to_normal(self):
        self.is_online = True
        self.fall_detected = False
        self.inactivity_detected = False
        self.override_gas_raw = None
        self.override_hr = None
        self.override_spo2 = None
        self.override_temp = None

    def generate_telemetry(self):
        if not self.is_online:
            return None

        # Apply small realistic fluctuations
        hr = self.override_hr if self.override_hr is not None else round(self.base_hr + random.uniform(-2.5, 3.5), 1)
        spo2 = self.override_spo2 if self.override_spo2 is not None else round(min(100.0, max(95.0, self.base_spo2 + random.uniform(-0.5, 0.5))), 1)
        temp = self.override_temp if self.override_temp is not None else round(self.base_temp + random.uniform(-0.3, 0.4), 1)
        humidity = round(min(100.0, max(20.0, self.base_humidity + random.uniform(-1.0, 1.0))), 1)
        gas = self.override_gas_raw if self.override_gas_raw is not None else int(self.base_gas_raw + random.randint(-15, 20))

        now_iso = datetime.now(timezone.utc).isoformat()

        payload = {
            "messageId": f"msg_{uuid.uuid4().hex[:12]}",
            "helmetId": self.helmet_id,
            "workerId": self.worker_id,
            "timestamp": now_iso,
            "vitals": {
                "heartRate": hr,
                "spo2": spo2,
            },
            "environment": {
                "temperature": temp,
                "humidity": humidity,
                "gasRaw": gas,
            },
            "motion": {
                "fallDetected": self.fall_detected,
                "inactivityDetected": self.inactivity_detected,
            },
            "isSimulated": True,
        }
        return payload

    def generate_alert(self, alert_type, severity, description, extra_sensor_data=None):
        now_iso = datetime.now(timezone.utc).isoformat()
        payload = {
            "eventId": f"evt_{alert_type.lower()}_{uuid.uuid4().hex[:8]}",
            "helmetId": self.helmet_id,
            "workerId": self.worker_id,
            "timestamp": now_iso,
            "alertType": alert_type,
            "severity": severity,
            "description": description,
            "sensorData": extra_sensor_data or {},
            "isSimulated": True,
        }
        return payload
