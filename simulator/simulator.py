#!/usr/bin/env python3
"""
SentinelX - ESP32 Smart Safety Helmet Simulator
Simulates continuous multi-sensor telemetry and safety incident alerts over MQTT.
"""

import sys
import time
import json
import threading
import argparse
import os
import paho.mqtt.client as mqtt

from config import (
    BROKER_HOST,
    BROKER_PORT,
    TELEMETRY_TOPIC_TEMPLATE,
    ALERT_TOPIC_TEMPLATE,
    SIMULATED_WORKERS,
)
from worker_simulator import WorkerSimulator
import scenarios

workers = [WorkerSimulator(w_cfg) for w_cfg in SIMULATED_WORKERS]
stop_event = threading.Event()
client = None

def simulation_workers(excluded_helmets):
    """Remove hardware-owned helmets from every simulator scenario for this run."""
    excluded = set(excluded_helmets)
    known = {item["helmet_id"] for item in SIMULATED_WORKERS}
    unknown = excluded - known
    if unknown:
        raise ValueError("Unknown helmet ID(s): " + ", ".join(sorted(unknown)))
    return [WorkerSimulator(item) for item in SIMULATED_WORKERS if item["helmet_id"] not in excluded]

def on_connect(c, userdata, flags, rc, properties=None):
    if rc == 0:
        print(f"\n[MQTT] Connected successfully to Mosquitto Broker at {BROKER_HOST}:{BROKER_PORT}")
    else:
        print(f"\n[MQTT] Connection failed with code {rc}")

def telemetry_loop():
    print("[Simulator] Telemetry background thread started. Publishing every 2.5s...")
    while not stop_event.is_set():
        for w in workers:
            if not w.is_online:
                continue
            payload = w.generate_telemetry()
            if payload and client and client.is_connected():
                topic = TELEMETRY_TOPIC_TEMPLATE.format(helmet_id=w.helmet_id)
                client.publish(topic, json.dumps(payload), qos=0)
        time.sleep(2.5)

def print_banner():
    print("""
========================================================================
   SENTINELX: ESP32 WEARABLE SAFETY SENSOR SIMULATOR (CLI)
   [SIMULATION MODE: ALL SENSOR DATA AND METRICS ARE SYNTHETIC]
========================================================================
""")

def print_worker_status():
    print("\n--- ACTIVE MONITORED WORKERS ---")
    for idx, w in enumerate(workers, 1):
        status_str = "ONLINE" if w.is_online else "OFFLINE"
        fall_str = "FALL" if w.fall_detected else "NORMAL"
        gas_str = f"OVERRIDE={w.override_gas_raw}" if w.override_gas_raw else "NORMAL"
        print(f" [{idx}] {w.name:<15} (Worker: {w.worker_id}, Helmet: {w.helmet_id}) | "
              f"Zone: {w.assigned_zone:<24} | Status: {status_str:<7} | Motion: {fall_str} | Gas: {gas_str}")
    print("--------------------------------\n")

def print_menu():
    print("""
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
""")

def select_worker():
    print_worker_status()
    choice = input(f"Select Worker [1-{len(workers)}] (default 1): ").strip()
    if choice.isdigit() and 1 <= int(choice) <= len(workers):
        return workers[int(choice) - 1]
    return workers[0]

def main():
    global client, workers
    parser = argparse.ArgumentParser(description="SentinelX synthetic sensor simulator")
    parser.add_argument("--exclude-helmet", action="append", default=[], metavar="HELMET_ID",
                        help="Reserve this helmet for physical hardware; repeat for multiple helmets")
    args = parser.parse_args()
    excluded = set(args.exclude_helmet) | {
        value.strip() for value in os.getenv("SENTINELX_HARDWARE_HELMETS", "").split(",") if value.strip()
    }
    try:
        workers = simulation_workers(excluded)
    except ValueError as error:
        parser.error(str(error))
    print_banner()
    if excluded:
        print("Reserved for physical hardware: " + ", ".join(sorted(excluded)))
    if not workers:
        print("All helmets are reserved for hardware. No simulator messages will be sent.")
        return

    # Setup MQTT
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="sentinelx_simulator_master")
    client.on_connect = on_connect

    try:
        client.connect(BROKER_HOST, BROKER_PORT, 60)
        client.loop_start()
    except Exception as e:
        print(f"❌ Error connecting to MQTT Broker: {e}")
        print("Please ensure Mosquitto is running on localhost:1883")
        sys.exit(1)

    # Start telemetry sender thread
    t_thread = threading.Thread(target=telemetry_loop, daemon=True)
    t_thread.start()

    time.sleep(1)

    while True:
        try:
            print_worker_status()
            print_menu()
            choice = input("SentinelX> ").strip()

            if choice == "1":
                scenarios.apply_scenario_normal(workers)
            elif choice == "2":
                target = select_worker()
                scenarios.apply_scenario_fall(target, client, ALERT_TOPIC_TEMPLATE)
            elif choice == "3":
                target = select_worker()
                gas_val = input("Enter gas level [default 780 for High Risk, 920 for Critical]: ").strip()
                val = int(gas_val) if gas_val.isdigit() else 780
                scenarios.apply_scenario_gas(target, val)
            elif choice == "4":
                target = select_worker()
                cond = input("Condition [1 for Hypoxia (SpO2=86%), 2 for Tachycardia (HR=138)]: ").strip()
                condition = "hypoxia" if cond != "2" else "tachycardia"
                scenarios.apply_scenario_abnormal_health(target, condition)
            elif choice == "5":
                target = select_worker()
                scenarios.apply_scenario_sos(target, client, ALERT_TOPIC_TEMPLATE)
            elif choice == "6":
                target = select_worker()
                scenarios.apply_scenario_offline(target)
            elif choice == "7":
                scenarios.apply_scenario_multi_incident(workers, client, ALERT_TOPIC_TEMPLATE)
            elif choice == "8":
                target = select_worker()
                target.reset_to_normal()
                print(f"✓ {target.name} ({target.helmet_id}) restored and reconnected.")
            elif choice == "9":
                scenarios.apply_scenario_normal(workers)
            elif choice in ["0", "exit", "quit", "q"]:
                print("Stopping SentinelX Simulator...")
                stop_event.set()
                client.loop_stop()
                client.disconnect()
                break
            else:
                print("Invalid selection. Please choose an option from the menu.")
        except (KeyboardInterrupt, EOFError):
            print("\nExiting simulator...")
            stop_event.set()
            break

if __name__ == "__main__":
    main()
