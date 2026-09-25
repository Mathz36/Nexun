import { Router } from 'express';
import { createEmailAlertController } from '../controllers/email-alert.controller';
import { EmailAlertService } from '../services/EmailAlertService';
import { validate } from '../middlewares/validate';
import { supplierAlertScheduleSchema, updateEmailAlertSchema } from '../../../shared/schemas/email-alert.schemas';
import { SyncSchedulerService } from '../services/SyncSchedulerService';

export function emailAlertRoutes(service: EmailAlertService, scheduler: SyncSchedulerService): Router {
  const router = Router();
  const controller = createEmailAlertController(service, scheduler);
  router.get('/', controller.get);
  router.put('/', validate(updateEmailAlertSchema), controller.update);
  router.get('/suppliers', controller.getSupplierSchedules);
  router.get('/suppliers/:supplier', controller.getSupplierSchedule);
  router.put('/suppliers/:supplier', validate(supplierAlertScheduleSchema), controller.updateSupplierSchedule);
  router.post('/test', controller.test);
  router.post('/send-now', controller.sendNow);
  return router;
}
