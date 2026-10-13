import { prisma } from '../config/db.js';
import { SeverityLevel, IncidentStatus } from '../types/index.js';
import { emitIncident, emitIncidentUpdate } from '../socket/io.js';

interface CreateIncidentInput {
  workerId: string;
  helmetId: string;
  incidentType: string;
  severity: SeverityLevel;
  description: string;
  detectedAt?: Date;
  eventId?: string;
}

export class IncidentService {
  // Deduplication cache for MQTT event IDs (keeps IDs for 5 minutes)
  private static processedEventIds = new Map<string, number>();

  // Check if an eventId was recently processed
  public static isDuplicateEvent(eventId?: string): boolean {
    if (!eventId) return false;
    this.cleanExpiredEventIds();
    if (this.processedEventIds.has(eventId)) {
      return true;
    }
    this.processedEventIds.set(eventId, Date.now() + 5 * 60 * 1000);
    return false;
  }

  private static cleanExpiredEventIds() {
    const now = Date.now();
    for (const [id, expiry] of this.processedEventIds.entries()) {
      if (now > expiry) {
        this.processedEventIds.delete(id);
      }
    }
  }

  /**
   * Creates an incident if no ACTIVE incident of the same type already exists for this worker.
   * This prevents telemetry ticks from spamming duplicate incident rows for the same ongoing condition.
   */
  public static async createIncident(data: CreateIncidentInput) {
    if (data.eventId && this.isDuplicateEvent(data.eventId)) {
      console.log(`[IncidentService] Duplicate eventId skipped: ${data.eventId}`);
      return null;
    }

    // Check if worker already has an ACTIVE incident of this specific type
    const existingActive = await prisma.incident.findFirst({
      where: {
        workerId: data.workerId,
        incidentType: data.incidentType,
        status: IncidentStatus.ACTIVE,
      },
    });

    if (existingActive) {
      // Worker already has an active incident for this hazard; update last description or return existing
      return existingActive;
    }

    const incident = await prisma.incident.create({
      data: {
        workerId: data.workerId,
        helmetId: data.helmetId,
        incidentType: data.incidentType,
        severity: data.severity,
        description: data.description,
        detectedAt: data.detectedAt || new Date(),
        status: IncidentStatus.ACTIVE,
      },
      include: {
        worker: true,
        helmet: true,
      },
    });

    console.log(`🚨 [IncidentService] Created ${incident.severity} incident [${incident.incidentType}] for Worker ${incident.workerId}`);
    emitIncident(incident);
    return incident;
  }

  public static async getAllIncidents(filters: {
    workerId?: string;
    severity?: SeverityLevel;
    status?: IncidentStatus;
    incidentType?: string;
  } = {}) {
    return prisma.incident.findMany({
      where: {
        ...(filters.workerId && { workerId: filters.workerId }),
        ...(filters.severity && { severity: filters.severity }),
        ...(filters.status && { status: filters.status }),
        ...(filters.incidentType && { incidentType: filters.incidentType }),
      },
      include: {
        worker: true,
        helmet: true,
      },
      orderBy: {
        detectedAt: 'desc',
      },
    });
  }

  public static async getActiveIncidents() {
    return prisma.incident.findMany({
      where: {
        status: {
          in: [IncidentStatus.ACTIVE, IncidentStatus.ACKNOWLEDGED],
        },
      },
      include: {
        worker: true,
        helmet: true,
      },
      orderBy: {
        detectedAt: 'desc',
      },
    });
  }

  public static async acknowledgeIncident(incidentId: string, acknowledgedBy = 'Control Center Supervisor') {
    const existing = await prisma.incident.findUnique({ where: { incidentId } });
    if (!existing) {
      throw new Error(`Incident ${incidentId} not found`);
    }

    const updated = await prisma.incident.update({
      where: { incidentId },
      data: {
        status: IncidentStatus.ACKNOWLEDGED,
        acknowledgedAt: new Date(),
        acknowledgedBy,
      },
      include: {
        worker: true,
        helmet: true,
      },
    });

    console.log(`[IncidentService] Acknowledged incident ${incidentId} by ${acknowledgedBy}`);
    emitIncidentUpdate(updated);
    return updated;
  }

  public static async resolveIncident(incidentId: string) {
    const existing = await prisma.incident.findUnique({ where: { incidentId } });
    if (!existing) {
      throw new Error(`Incident ${incidentId} not found`);
    }

    const updated = await prisma.incident.update({
      where: { incidentId },
      data: {
        status: IncidentStatus.RESOLVED,
        resolvedAt: new Date(),
      },
      include: {
        worker: true,
        helmet: true,
      },
    });

    console.log(`[IncidentService] Resolved incident ${incidentId}`);
    emitIncidentUpdate(updated);
    return updated;
  }
}
