import { Router } from 'express';
import { executionController } from '../controllers/execution.controller';

export function executionRoutes(): Router {
  const router = Router();
  router.get('/', executionController.list);
  router.get('/:id', executionController.getById);
  return router;
}
