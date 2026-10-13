import { Request, Response } from 'express';
import { IncidentService } from '../services/incident.service.js';
import { SeverityLevel, IncidentStatus } from '../types/index.js';

export async function getAllIncidents(req: Request, res: Response) {
  try {
    const { workerId, severity, status, incidentType } = req.query;

    const incidents = await IncidentService.getAllIncidents({
      workerId: workerId as string,
      severity: severity as SeverityLevel,
      status: status as IncidentStatus,
      incidentType: incidentType as string,
    });

    res.json(incidents);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function getActiveIncidents(req: Request, res: Response) {
  try {
    const active = await IncidentService.getActiveIncidents();
    res.json(active);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function acknowledgeIncident(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { acknowledgedBy } = req.body;

    const updated = await IncidentService.acknowledgeIncident(
      id,
      acknowledgedBy || 'Control Room Supervisor'
    );
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function resolveIncident(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const updated = await IncidentService.resolveIncident(id);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}
