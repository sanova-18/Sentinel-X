import { Router } from 'express';
import { getHelmetStatuses } from '../controllers/helmet.controller.js';

export const helmetRouter = Router();

helmetRouter.get('/status', getHelmetStatuses);
