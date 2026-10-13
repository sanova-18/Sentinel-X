import { z } from 'zod';

export enum SeverityLevel {
  NORMAL = 'NORMAL',
  WARNING = 'WARNING',
  HIGH_RISK = 'HIGH_RISK',
  CRITICAL = 'CRITICAL',
}

export enum ConnectivityStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
}

export enum IncidentStatus {
  ACTIVE = 'ACTIVE',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  RESOLVED = 'RESOLVED',
}

// Zod Schema for Telemetry Payload
export const TelemetryPayloadSchema = z.object({
  messageId: z.string().optional(),
  helmetId: z.string(),
  workerId: z.string(),
  timestamp: z.string().or(z.date()).transform((val) => new Date(val)),
  vitals: z.object({
    heartRate: z.number().nullable().optional(),
    spo2: z.number().nullable().optional(),
  }).optional(),
  environment: z.object({
    temperature: z.number().nullable().optional(),
    humidity: z.number().nullable().optional(),
    gasRaw: z.number().int().nullable().optional(),
  }).optional(),
  motion: z.object({
    fallDetected: z.boolean().default(false),
    inactivityDetected: z.boolean().default(false),
  }).optional(),
  isSimulated: z.boolean().default(true),
});

export type TelemetryPayload = z.infer<typeof TelemetryPayloadSchema>;

// Zod Schema for Immediate Alert Payload
export const AlertPayloadSchema = z.object({
  eventId: z.string(),
  helmetId: z.string(),
  workerId: z.string(),
  timestamp: z.string().or(z.date()).transform((val) => new Date(val)),
  alertType: z.string(),
  severity: z.nativeEnum(SeverityLevel),
  description: z.string(),
  sensorData: z.record(z.any()).optional(),
  isSimulated: z.boolean().default(true),
});

export type AlertPayload = z.infer<typeof AlertPayloadSchema>;

export interface EvaluatedAlert {
  incidentType: string;
  severity: SeverityLevel;
  description: string;
}

export interface RuleEngineResult {
  overallSeverity: SeverityLevel;
  alerts: EvaluatedAlert[];
}
