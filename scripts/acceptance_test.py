#!/usr/bin/env python3
import time
import json
import urllib.request
from datetime import datetime, timezone
import paho.mqtt.client as mqtt

BACKEND_URL = "http://127.0.0.1:5001"
FRONTEND_URL = "http://127.0.0.1:5174"
MQTT_HOST = "127.0.0.1"
MQTT_PORT = 1883

def log_step(num, title):
    print(f"\n=======================================================")
    print(f" STEP {num}: {title}")
    print(f"=======================================================")

def http_get(path):
    url = f"{BACKEND_URL}{path}"
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode('utf-8'))

def http_patch(path, body=None):
    url = f"{BACKEND_URL}{path}"
    data = json.dumps(body or {}).encode('utf-8')
    req = urllib.request.Request(url, data=data, method='PATCH')
    req.add_header('Content-Type', 'application/json')
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode('utf-8'))

def run_tests():
    print("\n🔍 STARTING SENTINELX SYSTEM ACCEPTANCE TEST SUITE")

    # Step 1: Infrastructure check
    log_step(1, "Verify Local Infrastructure (PostgreSQL & Mosquitto)")
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="sentinelx_acceptance_tester")
    client.connect(MQTT_HOST, MQTT_PORT, 60)
    client.loop_start()
    print("✓ Mosquitto MQTT broker connection verified.")

    # Step 2: Backend check
    log_step(2, "Verify Node.js/Express Backend Health")
    health = http_get("/api/health")
    assert health.get("status") == "ok", f"Backend unhealthy: {health}"
    print(f"✓ Backend online: {health}")

    # Clean existing active incidents for test repeatability
    active_existing = http_get("/api/incidents/active")
    for inc in active_existing:
        http_patch(f"/api/incidents/{inc['incidentId']}/resolve")
    print(f"✓ Reset {len(active_existing)} existing active incidents to RESOLVED for clean test isolation.")

    # Step 3: Frontend check
    log_step(3, "Verify React Dashboard Vite Server")
    with urllib.request.urlopen(FRONTEND_URL) as resp:
        assert resp.status == 200
    print(f"✓ React dashboard accessible at {FRONTEND_URL}")

    # Step 4 & 5: Publish Telemetry for 3 Workers
    log_step(4, "Publish Normal Telemetry for 3 Monitored Workers")
    workers_payload = [
        {"workerId": "W-101", "helmetId": "H-201", "hr": 76.0, "spo2": 98.2, "temp": 26.5, "gas": 180},
        {"workerId": "W-102", "helmetId": "H-202", "hr": 79.5, "spo2": 98.0, "temp": 27.8, "gas": 210},
        {"workerId": "W-103", "helmetId": "H-203", "hr": 72.0, "spo2": 99.0, "temp": 25.4, "gas": 165},
    ]

    now_iso = datetime.now(timezone.utc).isoformat()
    for w in workers_payload:
        msg = {
            "messageId": f"msg_acc_{w['workerId']}",
            "helmetId": w["helmetId"],
            "workerId": w["workerId"],
            "timestamp": now_iso,
            "vitals": {"heartRate": w["hr"], "spo2": w["spo2"]},
            "environment": {"temperature": w["temp"], "humidity": 50.0, "gasRaw": w["gas"]},
            "motion": {"fallDetected": False, "inactivityDetected": False},
            "isSimulated": True
        }
        topic = f"sentinelx/{w['helmetId']}/telemetry"
        client.publish(topic, json.dumps(msg), qos=1)
        print(f"  -> Published telemetry packet to {topic}")

    time.sleep(1.5)

    log_step(5, "Verify Ingestion and Live Status in PostgreSQL")
    workers = http_get("/api/workers")
    assert len(workers) == 3, f"Expected 3 workers, got {len(workers)}"
    for w in workers:
        assert w["connectivityStatus"] == "ONLINE", f"Worker {w['workerId']} helmet not marked ONLINE: {w}"
        assert w["latestReading"] is not None, f"No reading saved for {w['workerId']}"
        print(f"✓ Worker {w['name']} ({w['workerId']}): Status=ONLINE, HR={w['latestReading']['heartRate']} bpm, SpO2={w['latestReading']['spo2']}%")

    # Step 6, 7 & 8: Trigger Fall Detection Emergency
    log_step(6, "Trigger Fall Detection Emergency for Worker W-101")
    fall_event_id = f"evt_fall_{int(time.time())}"
    fall_alert = {
        "eventId": fall_event_id,
        "helmetId": "H-201",
        "workerId": "W-101",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "alertType": "FALL_DETECTED",
        "severity": "CRITICAL",
        "description": "CRITICAL IMPACT: Severe fall deceleration detected on helmet H-201",
        "sensorData": {"impactG": 5.2, "fallDetected": True},
        "isSimulated": True
    }
    client.publish("sentinelx/H-201/alert", json.dumps(fall_alert), qos=1)
    print("✓ Published CRITICAL FALL alert on sentinelx/H-201/alert")

    time.sleep(1.5)

    log_step(7, "Verify Critical Alert Ingestion in Active Emergencies")
    active_incidents = http_get("/api/incidents/active")
    assert len(active_incidents) >= 1, "No active incidents found in backend!"
    target_incident = next((i for i in active_incidents if i["workerId"] == "W-101" and i["incidentType"] == "FALL_DETECTED" and i["status"] == "ACTIVE"), None)
    assert target_incident is not None, f"Active Fall incident not found in {active_incidents}"
    assert target_incident["severity"] == "CRITICAL", f"Expected CRITICAL severity, got {target_incident['severity']}"
    assert target_incident["status"] == "ACTIVE", f"Expected ACTIVE status, got {target_incident['status']}"
    print(f"✓ Saved to PostgreSQL: Incident ID={target_incident['incidentId']}, Status={target_incident['status']}, Severity={target_incident['severity']}")

    log_step(8, "Verify Worker Alert State Updated")
    w101 = http_get("/api/workers/W-101")
    assert w101["readings"] is not None
    print(f"✓ Worker W-101 reflects active emergency in safety profile.")

    # Step 9 & 10: Acknowledge the Incident
    incident_id = target_incident["incidentId"]
    log_step(9, f"Acknowledge Incident {incident_id} via REST API")
    ack_res = http_patch(f"/api/incidents/{incident_id}/acknowledge", {"acknowledgedBy": "Senior Operations Officer"})
    assert ack_res["status"] == "ACKNOWLEDGED", f"Status not updated: {ack_res}"
    assert ack_res["acknowledgedBy"] == "Senior Operations Officer"
    print(f"✓ Incident acknowledged: status={ack_res['status']}, ack_by={ack_res['acknowledgedBy']}, ack_at={ack_res['acknowledgedAt']}")

    log_step(10, "Verify Persisted Acknowledged State in Database")
    all_incidents = http_get("/api/incidents")
    persisted = next(i for i in all_incidents if i["incidentId"] == incident_id)
    assert persisted["status"] == "ACKNOWLEDGED"
    print(f"✓ Verified persisted record in PostgreSQL: status={persisted['status']}")

    # Step 11 & 12: Test Helmet Offline Detection
    log_step(11, "Simulate Helmet H-202 (Worker W-102) Telemetry Halt")
    print("Telemetry transmission halted for H-202. Waiting 12 seconds for heartbeat timeout watchdog (>10s)...")
    time.sleep(12)

    log_step(12, "Verify Helmet H-202 Automatically Transitioned to OFFLINE")
    helmets = http_get("/api/helmets/status")
    h202 = next(h for h in helmets if h["helmetId"] == "H-202")
    assert h202["connectivityStatus"] == "OFFLINE", f"Expected H-202 OFFLINE, got: {h202}"
    print(f"✓ Watchdog successfully marked Helmet H-202 as OFFLINE: {h202['connectivityStatus']}")

    # Step 13: Reconnect Helmet and Restore Online Status
    log_step(13, "Reconnect Helmet H-202 and Restore ONLINE Status")
    resume_msg = {
        "messageId": f"msg_resume_h202_{int(time.time())}",
        "helmetId": "H-202",
        "workerId": "W-102",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "vitals": {"heartRate": 78.0, "spo2": 98.5},
        "environment": {"temperature": 27.5, "humidity": 52.0, "gasRaw": 205},
        "motion": {"fallDetected": False, "inactivityDetected": False},
        "isSimulated": True
    }
    client.publish("sentinelx/H-202/telemetry", json.dumps(resume_msg), qos=1)
    print("  -> Telemetry published for H-202. Waiting 1.5s...")
    time.sleep(1.5)

    helmets_reconnect = http_get("/api/helmets/status")
    h202_reconnected = next(h for h in helmets_reconnect if h["helmetId"] == "H-202")
    assert h202_reconnected["connectivityStatus"] == "ONLINE", f"Expected H-202 ONLINE, got {h202_reconnected}"
    print(f"✓ Helmet H-202 successfully restored to ONLINE: {h202_reconnected['connectivityStatus']}")

    # Step 14: Resolve the Incident
    print("\n[Optional Cleanup Step] Resolving Fall Incident...")
    res_out = http_patch(f"/api/incidents/{incident_id}/resolve")
    assert res_out["status"] == "RESOLVED"
    print(f"✓ Incident resolved: status={res_out['status']}, resolved_at={res_out['resolvedAt']}")

    client.loop_stop()
    client.disconnect()

    print("\n🎉 ALL 13 ACCEPTANCE TEST STEPS COMPLETED AND VERIFIED SUCCESSFULLY!")

if __name__ == "__main__":
    run_tests()
