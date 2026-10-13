import json

def apply_scenario_normal(workers):
    for w in workers:
        w.reset_to_normal()
    print("▶ Scenario 1 Applied: All workers reset to Normal Telemetry ranges.")

def apply_scenario_fall(worker, mqtt_client, alert_topic_template):
    worker.fall_detected = True
    worker.override_hr = 118.0
    alert_payload = worker.generate_alert(
        alert_type="FALL_DETECTED",
        severity="CRITICAL",
        description=f"CRITICAL: Sudden impact acceleration & freefall detected on helmet {worker.helmet_id} ({worker.name})",
        extra_sensor_data={"fallDetected": True, "heartRate": 118.0, "impactG": 4.8}
    )
    topic = alert_topic_template.format(helmet_id=worker.helmet_id)
    mqtt_client.publish(topic, json.dumps(alert_payload), qos=1)
    print(f"🚨 Scenario 2 Applied: Fall event triggered for {worker.name} ({worker.helmet_id}). Published to {topic}")
    return alert_payload

def apply_scenario_gas(worker, gas_level=780):
    worker.override_gas_raw = gas_level
    print(f"⚠️ Scenario 3 Applied: Gas reading elevated to {gas_level} for {worker.name} in {worker.assigned_zone}.")

def apply_scenario_abnormal_health(worker, condition_type="hypoxia"):
    if condition_type == "hypoxia":
        worker.override_spo2 = 86.5
        worker.override_hr = 105.0
        print(f"⚠️ Scenario 4 Applied: Hypoxia simulated for {worker.name} (SpO2=86.5%, HR=105 bpm).")
    else:
        worker.override_hr = 138.0
        print(f"⚠️ Scenario 4 Applied: Tachycardia simulated for {worker.name} (HR=138 bpm).")

def apply_scenario_sos(worker, mqtt_client, alert_topic_template):
    alert_payload = worker.generate_alert(
        alert_type="SOS_TRIGGERED",
        severity="CRITICAL",
        description=f"CRITICAL: Emergency SOS button manually depressed by {worker.name} in {worker.assigned_zone}",
        extra_sensor_data={"sosPressed": True, "zone": worker.assigned_zone}
    )
    topic = alert_topic_template.format(helmet_id=worker.helmet_id)
    mqtt_client.publish(topic, json.dumps(alert_payload), qos=1)
    print(f"🆘 Scenario 5 Applied: SOS Panic trigger published for {worker.name} ({worker.helmet_id})!")
    return alert_payload

def apply_scenario_offline(worker):
    worker.is_online = False
    print(f"🔌 Scenario 6 Applied: Helmet {worker.helmet_id} ({worker.name}) disconnected. Telemetry stream halted.")

def apply_scenario_multi_incident(workers, mqtt_client, alert_topic_template):
    if len(workers) >= 2:
        # Worker 1: Fall
        apply_scenario_fall(workers[0], mqtt_client, alert_topic_template)
        # Worker 2: Gas Leak
        apply_scenario_gas(workers[1], gas_level=920)
        # Worker 3 (if exists): Hypoxia
        if len(workers) >= 3:
            apply_scenario_abnormal_health(workers[2], "hypoxia")
        print("💥 Scenario 7 Applied: Multi-worker hazardous incident cascade triggered across zones!")
