import { Router } from 'express';
import {
  getAllWorkers,
  getWorkerById,
  getWorkerLatestReading,
  getWorkerHistory,
} from '../controllers/worker.controller.js';

export const workerRouter = Router();

workerRouter.get('/', getAllWorkers);
workerRouter.get('/:id', getWorkerById);
workerRouter.get('/:id/latest', getWorkerLatestReading);
workerRouter.get('/:id/history', getWorkerHistory);
