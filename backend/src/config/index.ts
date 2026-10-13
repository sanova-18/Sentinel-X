import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://varunshrotri@localhost:5432/sentinelx_db?schema=public',
  mqtt: {
    brokerUrl: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
    telemetryTopic: process.env.MQTT_TELEMETRY_TOPIC || 'sentinelx/+/telemetry',
    alertTopic: process.env.MQTT_ALERT_TOPIC || 'sentinelx/+/alert',
  },
  heartbeatTimeoutMs: parseInt(process.env.HEARTBEAT_TIMEOUT_MS || '10000', 10),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',

  // Configurable prototype thresholds for educational demonstration
  thresholds: {
    heartRate: {
      minNormal: 50, // < 50 is Bradycardia (WARNING)
      maxNormal: 125, // > 125 is Tachycardia (HIGH_RISK)
      criticalMax: 150, // > 150 is Critical Tachycardia
    },
    spo2: {
      warningMin: 92, // < 92% is Mild Hypoxia (WARNING)
      criticalMin: 88, // < 88% is Severe Hypoxia (CRITICAL)
    },
    gasRaw: {
      warningThreshold: 650, // > 650 is Elevated Gas (HIGH_RISK)
      criticalThreshold: 850, // > 850 is Toxic Gas Surge (CRITICAL)
    },
    temperature: {
      heatWarning: 38.0, // > 38°C is Heat Stress (WARNING)
      heatCritical: 42.0, // > 42°C is Critical Heat Exposure
    },
    heartbeatWatchdogIntervalMs: 3000,
  },
};
