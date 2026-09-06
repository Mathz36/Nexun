import { Router } from 'express';
import { createReportController } from '../controllers/report.controller';
import { ReportService } from '../services/ReportService';
import { validate } from '../middlewares/validate';
import {
  createReportSchema,
  updateReportSchema,
  testQuerySchema,
  reportIdParamSchema,
} from '../../../shared/schemas/report.schemas';

export function reportRoutes(reportService: ReportService): Router {
  const router = Router();
  const controller = createReportController(reportService);

  router.get('/', controller.list);
  router.post('/', validate(createReportSchema), controller.create);
  router.post('/execute-all', controller.executeAll);
  // Testa uma query ANTES de o relatório existir (tela de cadastro) —
  // não depende de um :id, pois o relatório pode ainda não ter sido salvo.
  router.post('/test', validate(testQuerySchema), controller.testQuery);
  router.get('/:id', validate(reportIdParamSchema, 'params'), controller.getById);
  router.put('/:id', validate(reportIdParamSchema, 'params'), validate(updateReportSchema), controller.update);
  router.delete('/:id', validate(reportIdParamSchema, 'params'), controller.delete);
  // Re-testa a query de um relatório já salvo.
  router.post('/:id/test', validate(reportIdParamSchema, 'params'), controller.testQuery);
  router.post('/:id/execute', validate(reportIdParamSchema, 'params'), controller.execute);

  return router;
}
