import { Router } from 'express';
import { workerRouter } from './worker.routes.js';
import { incidentRouter } from './incident.routes.js';
import { helmetRouter } from './helmet.routes.js';

export const apiRouter = Router();

apiRouter.use('/workers', workerRouter);
apiRouter.use('/incidents', incidentRouter);
apiRouter.use('/helmets', helmetRouter);

apiRouter.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    system: 'SentinelX Safety Monitoring Prototype',
    deploymentMode: 'educational-prototype',
    dataSourceMode: 'per-message',
    timestamp: new Date().toISOString(),
    // Kept for older clients; source belongs to each reading/incident, not the server.
    isSimulatedMode: null,
  });
});
