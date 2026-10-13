import mqtt, { MqttClient } from 'mqtt';
import { config } from '../config/index.js';
import { handleTelemetryMessage, handleAlertMessage } from './handlers.js';

let client: MqttClient | null = null;

export function initMqttClient(): MqttClient {
  console.log(`[MQTT] Connecting to broker at ${config.mqtt.brokerUrl}...`);

  client = mqtt.connect(config.mqtt.brokerUrl, {
    clientId: `sentinelx_backend_${Math.random().toString(16).substring(2, 8)}`,
    clean: true,
    connectTimeout: 5000,
    reconnectPeriod: 2000,
  });

  client.on('connect', () => {
    console.log('✅ [MQTT] Successfully connected to Mosquitto Broker.');

    client?.subscribe(config.mqtt.telemetryTopic, { qos: 0 }, (err) => {
      if (err) console.error(`[MQTT] Failed to subscribe to ${config.mqtt.telemetryTopic}:`, err);
      else console.log(`📡 [MQTT] Subscribed to topic: ${config.mqtt.telemetryTopic}`);
    });

    client?.subscribe(config.mqtt.alertTopic, { qos: 1 }, (err) => {
      if (err) console.error(`[MQTT] Failed to subscribe to ${config.mqtt.alertTopic}:`, err);
      else console.log(`🚨 [MQTT] Subscribed to topic: ${config.mqtt.alertTopic}`);
    });
  });

  client.on('message', (topic, message) => {
    if (topic.endsWith('/telemetry')) {
      handleTelemetryMessage(topic, message);
    } else if (topic.endsWith('/alert')) {
      handleAlertMessage(topic, message);
    }
  });

  client.on('error', (err) => {
    console.error('❌ [MQTT] Connection error:', err.message);
  });

  client.on('offline', () => {
    console.warn('⚠️ [MQTT] Client is offline.');
  });

  return client;
}

export function getMqttClient(): MqttClient | null {
  return client;
}
