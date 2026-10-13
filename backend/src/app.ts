import express from 'express';
import http from 'http';
import cors from 'cors';
import { config } from './config/index.js';
import { apiRouter } from './routes/index.js';
import { initSocketServer } from './socket/io.js';
import { initMqttClient } from './mqtt/client.js';
import { HeartbeatService } from './services/heartbeat.service.js';

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());

// API Routes
app.use('/api', apiRouter);

// Initialize Socket.IO
initSocketServer(server);

// Initialize MQTT Subscriber
initMqttClient();

// Start Heartbeat Watchdog
HeartbeatService.startWatchdog();

// Start Server
server.listen(config.port, () => {
  console.log(`
==========================================================
   SENTINELX: INDUSTRIAL SAFETY MONITORING SERVER
==========================================================
 🚀 REST API & Socket.IO: http://localhost:${config.port}
 📡 MQTT Broker:          ${config.mqtt.brokerUrl}
 🗄️ Database:             ${config.databaseUrl}
 ⏱️ Heartbeat Watchdog:   Timeout = ${config.heartbeatTimeoutMs}ms
 ⚠️ SIMULATION MODE:      ACTIVE (Educational Prototype)
==========================================================
  `);
});

export { app, server };
