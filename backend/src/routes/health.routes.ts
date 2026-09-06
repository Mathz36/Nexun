import { Router } from 'express';
import { createHealthController } from '../controllers/health.controller';
import { SankhyaClient } from '../integrations/sankhya/SankhyaClient';

export function healthRoutes(sankhyaClient: SankhyaClient): Router {
  const router = Router();
  const controller = createHealthController(sankhyaClient);

  router.get('/', controller.health);
  router.get('/sankhya', controller.sankhyaHealth);

  return router;
}
