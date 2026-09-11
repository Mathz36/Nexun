import { Router } from 'express';
import { createDashboardController } from '../controllers/dashboard.controller';
import { DashboardService } from '../services/DashboardService';

export function dashboardRoutes(dashboardService: DashboardService): Router {
  const router = Router();
  const controller = createDashboardController(dashboardService);

  router.get('/', controller.getDashboard);
  router.get('/suppliers', controller.listSuppliers);
  router.get('/suppliers/:supplier/comparison', controller.getSupplierComparison);
  router.get('/suppliers/:supplier', controller.getSupplier);

  return router;
}
