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
    system: 'SentinelX Industrial Safety Core',
    timestamp: new Date().toISOString(),
    isSimulatedMode: true,
  });
});
