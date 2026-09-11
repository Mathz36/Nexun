import { Router } from 'express';
import { createComparisonController } from '../controllers/comparison.controller';
import { CrossReportService } from '../services/CrossReportService';
import { validate } from '../middlewares/validate';
import { createComparisonSchema } from '../../../shared/schemas/report.schemas';

export function comparisonRoutes(crossReportService: CrossReportService): Router {
  const router = Router();
  const controller = createComparisonController(crossReportService);

  router.post('/', validate(createComparisonSchema), controller.create);
  router.get('/:id', controller.getById);
  // Não faz parte da lista original de endpoints do spec, mas é necessário
  // para a tela "Cruzar Relatórios" listar as opções do fornecedor selecionado.
  router.get('/reports/by-supplier/:fornecedor', controller.listReportsForSupplier);

  return router;
}
