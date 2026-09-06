import { Router } from 'express';
import { reportRoutes } from './report.routes';
import { dashboardRoutes } from './dashboard.routes';
import { comparisonRoutes } from './comparison.routes';
import { executionRoutes } from './execution.routes';
import { healthRoutes } from './health.routes';
import { ReportService } from '../services/ReportService';
import { DashboardService } from '../services/DashboardService';
import { CrossReportService } from '../services/CrossReportService';
import { SankhyaClient } from '../integrations/sankhya/SankhyaClient';
import { SyncSchedulerService } from '../services/SyncSchedulerService';
import { syncRoutes } from './sync.routes';
import { EmailAlertService } from '../services/EmailAlertService';
import { emailAlertRoutes } from './email-alert.routes';

export interface AppServices {
  reportService: ReportService;
  dashboardService: DashboardService;
  crossReportService: CrossReportService;
  sankhyaClient: SankhyaClient;
  syncScheduler: SyncSchedulerService;
  emailAlertService: EmailAlertService;
}

export function apiRouter(services: AppServices): Router {
  const router = Router();

  router.use('/reports', reportRoutes(services.reportService));
  router.use('/dashboard', dashboardRoutes(services.dashboardService));
  router.use('/comparisons', comparisonRoutes(services.crossReportService));
  router.use('/executions', executionRoutes());
  router.use('/health', healthRoutes(services.sankhyaClient));
  router.use('/sync', syncRoutes(services.syncScheduler));
  router.use('/email-alert', emailAlertRoutes(services.emailAlertService, services.syncScheduler));

  return router;
}
