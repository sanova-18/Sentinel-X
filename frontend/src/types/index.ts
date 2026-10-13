export type SeverityLevel = 'NORMAL' | 'WARNING' | 'HIGH_RISK' | 'CRITICAL';
export type IncidentStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
export type ConnectivityStatus = 'ONLINE' | 'OFFLINE';

export interface SensorReading {
  readingId: number;
  helmetId: string;
  workerId: string;
  heartRate: number | null;
  spo2: number | null;
  gasRaw: number | null;
  temperature: number | null;
  humidity: number | null;
  fallDetected: boolean;
  inactivityDetected: boolean;
  timestamp: string;
}

export interface Worker {
  workerId: string;
  name: string;
  assignedZone: string;
  helmetId: string | null;
  connectivityStatus: ConnectivityStatus;
  lastSeen: string | null;
  latestReading: SensorReading | null;
  activeIncidents: Incident[];
  hasActiveAlert: boolean;
  riskLevel?: SeverityLevel;
}

export interface Incident {
  incidentId: string;
  workerId: string;
  helmetId: string;
  incidentType: string;
  severity: SeverityLevel;
  description: string;
  detectedAt: string;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  resolvedAt: string | null;
  status: IncidentStatus;
  worker?: {
    name: string;
    assignedZone: string;
  };
}

export interface LiveTelemetryEvent {
  messageId?: string;
  readingId?: number;
  helmetId: string;
  workerId: string;
  workerName?: string;
  assignedZone?: string;
  timestamp: string;
  vitals?: {
    heartRate?: number | null;
    spo2?: number | null;
  };
  environment?: {
    temperature?: number | null;
    humidity?: number | null;
    gasRaw?: number | null;
  };
  motion?: {
    fallDetected: boolean;
    inactivityDetected: boolean;
  };
  riskLevel: SeverityLevel;
  isSimulated: boolean;
}
