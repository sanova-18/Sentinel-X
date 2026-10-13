import { Router } from 'express';
import {
  getAllIncidents,
  getActiveIncidents,
  acknowledgeIncident,
  resolveIncident,
} from '../controllers/incident.controller.js';

export const incidentRouter = Router();

incidentRouter.get('/', getAllIncidents);
incidentRouter.get('/active', getActiveIncidents);
incidentRouter.patch('/:id/acknowledge', acknowledgeIncident);
incidentRouter.patch('/:id/resolve', resolveIncident);
