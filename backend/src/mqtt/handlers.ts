import { prisma } from '../config/db.js';
import {
  TelemetryPayloadSchema,
  AlertPayloadSchema,
  SeverityLevel,
} from '../types/index.js';
import { RuleEngineService } from '../services/rule-engine.service.js';
import { IncidentService } from '../services/incident.service.js';
import { HeartbeatService } from '../services/heartbeat.service.js';
import { emitTelemetry } from '../socket/io.js';

export async function handleTelemetryMessage(topic: string, messageBuffer: Buffer) {
  try {
    const raw = JSON.parse(messageBuffer.toString());
    const parseResult = TelemetryPayloadSchema.safeParse(raw);

    if (!parseResult.success) {
      console.warn(`[MQTT] Invalid telemetry payload received on ${topic}:`, parseResult.error.format());
      return;
    }

    const payload = parseResult.data;

    // 1. Update heartbeat
    await HeartbeatService.recordPing(payload.helmetId, payload.timestamp);

    // 2. Persist SensorReading in PostgreSQL
    const reading = await prisma.sensorReading.create({
      data: {
        helmetId: payload.helmetId,
        workerId: payload.workerId,
        heartRate: payload.vitals?.heartRate ?? null,
        spo2: payload.vitals?.spo2 ?? null,
        gasRaw: payload.environment?.gasRaw ?? null,
        temperature: payload.environment?.temperature ?? null,
        humidity: payload.environment?.humidity ?? null,
        fallDetected: payload.motion?.fallDetected ?? false,
        inactivityDetected: payload.motion?.inactivityDetected ?? false,
        timestamp: payload.timestamp,
      },
      include: {
        worker: true,
      },
    });

    // 3. Evaluate Rule Engine for safety thresholds
    const evaluation = RuleEngineService.evaluateTelemetry(payload);

    // 4. Create incidents if hazards detected
    for (const alert of evaluation.alerts) {
      await IncidentService.createIncident({
        workerId: payload.workerId,
        helmetId: payload.helmetId,
        incidentType: alert.incidentType,
        severity: alert.severity,
        description: alert.description,
        detectedAt: payload.timestamp,
      });
    }

    // 5. Broadcast to Socket.IO clients
    emitTelemetry({
      ...payload,
      readingId: reading.readingId,
      workerName: reading.worker.name,
      assignedZone: reading.worker.assignedZone,
      riskLevel: evaluation.overallSeverity,
    });
  } catch (err) {
    console.error(`[MQTT] Error processing telemetry on ${topic}:`, err);
  }
}

export async function handleAlertMessage(topic: string, messageBuffer: Buffer) {
  try {
    const raw = JSON.parse(messageBuffer.toString());
    const parseResult = AlertPayloadSchema.safeParse(raw);

    if (!parseResult.success) {
      console.warn(`[MQTT] Invalid alert payload received on ${topic}:`, parseResult.error.format());
      return;
    }

    const payload = parseResult.data;

    // 1. Update heartbeat
    await HeartbeatService.recordPing(payload.helmetId, payload.timestamp);

    // 2. Create Incident immediately
    await IncidentService.createIncident({
      workerId: payload.workerId,
      helmetId: payload.helmetId,
      incidentType: payload.alertType,
      severity: payload.severity,
      description: payload.description,
      detectedAt: payload.timestamp,
      eventId: payload.eventId,
    });
  } catch (err) {
    console.error(`[MQTT] Error processing alert on ${topic}:`, err);
  }
}
