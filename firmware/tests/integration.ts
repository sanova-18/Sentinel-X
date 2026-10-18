// Run from backend: ./node_modules/.bin/tsx ../firmware/tests/integration.ts
// Temporary fixtures only; no changes to W-101/H-201 or existing incidents.
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { TelemetryPayloadSchema, AlertPayloadSchema } from '../../backend/src/types/index.js';
const backendRequire = createRequire(new URL('../../backend/package.json', import.meta.url));
const frontendRequire = createRequire(new URL('../../frontend/package.json', import.meta.url));
const { PrismaClient } = backendRequire('@prisma/client');
const mqtt = backendRequire('mqtt');
const { io } = frontendRequire('socket.io-client');
backendRequire('dotenv').config();
const db = new PrismaClient();
const suffix = randomUUID().slice(0, 8);
const workerId = `TEST-HW-W-${suffix}`, helmetId = `TEST-HW-H-${suffix}`;
const api = process.env.TEST_API_URL || 'http://localhost:5001';
let client: any, socket: any;
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(check: () => Promise<any>, label: string, timeout = 7000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const result = await check();
    if (result) return result;
    await delay(100);
  }
  throw new Error(`Timeout: ${label}`);
}
async function main() {
  try {
    assert.equal((await fetch(`${api}/api/health`)).status, 200);
    await db.helmet.create({ data: { helmetId, assignedWorkerId: workerId } });
    await db.worker.create({ data: { workerId, name: 'TEMPORARY hardware contract test',
      assignedZone: 'BENCH TEST - synthetic fixture', assignedHelmetId: helmetId } });
    const seen: any[] = [];
    socket = io(api, { transports: ['websocket'], reconnection: false });
    socket.on('telemetry:new', (event: any) => seen.push(event));
    await waitFor(async () => socket.connected, 'Socket.IO connection');
    client = mqtt.connect(process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883', {
      clientId: `sentinelx-test-${suffix}`, reconnectPeriod: 0,
    });
    await waitFor(async () => client.connected, 'MQTT connection');
    const timestamp = new Date().toISOString();
    const payload = { messageId: `bench-${suffix}`, workerId, helmetId, timestamp,
      vitals: { heartRate: null, spo2: null },
      environment: { gasRaw: null, temperature: null, humidity: null },
      motion: { fallDetected: false, inactivityDetected: false }, isSimulated: false };
    assert.equal(TelemetryPayloadSchema.safeParse(payload).success, true);
    assert.equal(TelemetryPayloadSchema.safeParse({ ...payload, environment: { gasRaw: 2.5 } }).success, false);
    await client.publishAsync(`sentinelx/${helmetId}/telemetry`, JSON.stringify(payload), { qos: 0 });
    const reading = await waitFor(() => db.sensorReading.findFirst({ where: { workerId } }), 'database reading');
    assert.equal(reading.heartRate, null); assert.equal(reading.gasRaw, null);
    assert.equal(reading.isSimulated, false);
    const event = await waitFor(async () => seen.find(e => e.messageId === payload.messageId), 'live dashboard event');
    assert.equal(event.isSimulated, false); assert.equal(event.riskLevel, 'NORMAL');
    assert.equal((await db.helmet.findUnique({ where: { helmetId } })).connectivityStatus, 'ONLINE');
    const response = await fetch(`${api}/api/workers/${workerId}`);
    assert.equal(response.status, 200);
    const worker: any = await response.json();
    assert.equal(worker.readings[0].readingId, reading.readingId);
    assert.equal(worker.readings[0].isSimulated, false);
    for (const source of [true, null]) {
      const next = { ...payload, messageId: `source-${source}-${suffix}`, timestamp: new Date().toISOString() };
      if (source === null) delete (next as any).isSimulated;
      else next.isSimulated = source;
      await client.publishAsync(`sentinelx/${helmetId}/telemetry`, JSON.stringify(next));
      const saved = await waitFor(() => db.sensorReading.findFirst({ where: { workerId, isSimulated: source } }), 'stored source');
      assert.equal(saved.isSimulated, source);
      const live = await waitFor(async () => seen.find(e => e.messageId === next.messageId), 'live source');
      assert.equal(live.isSimulated, source);
    }
    const history: any = await (await fetch(`${api}/api/workers/${workerId}/history`)).json();
    assert.deepEqual(history.map((r: any) => r.isSimulated).sort(), [false, true, null].sort());
    const acks: any[] = [];
    client.on('message', (topic: string, body: Buffer) => {
      if (topic === `sentinelx/${helmetId}/ack`) acks.push(JSON.parse(body.toString()));
    });
    await client.subscribeAsync(`sentinelx/${helmetId}/ack`, { qos: 1 });
    // Deliberately unique test type: does not trigger an SOS/fall banner for a real worker.
    const alert = { eventId: `bench-event-${suffix}`, workerId, helmetId,
      timestamp: new Date().toISOString(), alertType: 'HARDWARE_CONTRACT_TEST',
      severity: 'WARNING', description: 'Temporary synthetic transport check; automatically removed', isSimulated: true };
    assert.equal(AlertPayloadSchema.safeParse(alert).success, true);
    await client.publishAsync(`sentinelx/${helmetId}/alert`, JSON.stringify(alert), { qos: 0 });
    const incident = await waitFor(() => db.incident.findFirst({ where: { workerId } }), 'alert persistence');
    const ack = await waitFor(async () => acks[0], 'persisted application ACK');
    assert.deepEqual(ack, { helmetId, workerId, eventId: alert.eventId, status: 'persisted' });
    assert.equal(await db.alertReceipt.count({ where: { helmetId } }), 1);
    assert.equal(incident.isSimulated, true);
    await client.publishAsync(`sentinelx/${helmetId}/alert`, JSON.stringify(alert), { qos: 0 });
    await waitFor(async () => acks.length >= 2, 'replayed ACK');
    assert.equal(await db.incident.count({ where: { workerId } }), 1);
    assert.equal(await db.alertReceipt.count({ where: { helmetId } }), 1);
    // Operator acknowledgement must not split the same ongoing hazard.
    await db.incident.update({ where: { incidentId: incident.incidentId }, data: { status: 'ACKNOWLEDGED' } });
    await client.publishAsync(`sentinelx/${helmetId}/alert`, JSON.stringify({ ...alert, eventId: `${alert.eventId}-second` }));
    await waitFor(async () => acks.length >= 3, 'second event ACK');
    assert.equal(await db.incident.count({ where: { workerId } }), 1);
    assert.equal(await db.alertReceipt.count({ where: { helmetId } }), 2);
    // A new transport connection replays the stored event successfully.
    const replay = mqtt.connect(process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883', {
      clientId: `sentinelx-replay-${suffix}`, reconnectPeriod: 0,
    });
    try {
      await waitFor(async () => replay.connected, 'replay connection');
      await replay.publishAsync(`sentinelx/${helmetId}/alert`, JSON.stringify(alert));
      await waitFor(async () => acks.length >= 4, 'reconnect replay ACK');
    } finally { await replay.endAsync(); }
    for (const source of [false, null]) {
      await client.publishAsync(`sentinelx/${helmetId}/alert`, JSON.stringify({ ...alert,
        eventId: `${alert.eventId}-${source}`, isSimulated: source }));
      await waitFor(() => db.incident.findFirst({ where: { workerId, isSimulated: source } }), 'separate source incident');
    }
    await waitFor(async () => acks.length >= 6, 'all source ACKs');
    assert.equal(await db.incident.count({ where: { workerId } }), 3);
    assert.equal(await db.alertReceipt.count({ where: { helmetId } }), 4);
    // Altering the source for an already persisted event must not get an ACK.
    const ackCount = acks.length;
    await client.publishAsync(`sentinelx/${helmetId}/alert`, JSON.stringify({ ...alert, isSimulated: false }));
    await delay(600);
    assert.equal(acks.length, ackCount);
    await waitFor(async () => (await db.helmet.findUnique({ where: { helmetId } })).connectivityStatus === 'OFFLINE',
      'offline watchdog', 18000);
    console.log('PASS: Zod/nulls, MQTT, DB/REST/Socket.IO three-state sources, persisted ACK/replay, dedup, acknowledged hazard grouping, source conflict rejection, offline watchdog');
  } finally {
    if (client) await client.endAsync();
    socket?.disconnect();
    await db.$transaction([
      db.incident.deleteMany({ where: { workerId } }),
      db.sensorReading.deleteMany({ where: { workerId } }),
      db.worker.deleteMany({ where: { workerId } }),
      db.helmet.deleteMany({ where: { helmetId } }),
    ]);
    await db.$disconnect();
    console.log(`Removed only temporary fixtures ${workerId}/${helmetId}`);
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
