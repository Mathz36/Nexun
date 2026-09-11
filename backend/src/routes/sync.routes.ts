import { Router } from 'express';
import { createSyncController } from '../controllers/sync.controller';
import { SyncSchedulerService } from '../services/SyncSchedulerService';
import { validate } from '../middlewares/validate';
import { updateSyncScheduleSchema } from '../../../shared/schemas/sync-schedule.schemas';

export function syncRoutes(scheduler: SyncSchedulerService): Router {
  const router = Router();
  const controller = createSyncController(scheduler);

  router.get('/', controller.getSchedule);
  router.put('/', validate(updateSyncScheduleSchema), controller.updateSchedule);
  router.post('/run-now', controller.runNow);

  return router;
}
