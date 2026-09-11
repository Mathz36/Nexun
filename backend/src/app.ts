import express, { Application } from 'express';
import cors from 'cors';
import { apiRouter } from './routes';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';
import { createSankhyaIntegration } from './integrations/sankhya';
import { ReportService } from './services/ReportService';
import { DashboardService } from './services/DashboardService';
import { CrossReportService } from './services/CrossReportService';
import { SyncSchedulerService } from './services/SyncSchedulerService';
import { EmailAlertService } from './services/EmailAlertService';

export function createApp(): Application {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '5mb' }));

  // --- Composição de dependências (sem framework de DI: simples e explícito) ---
  const { client: sankhyaClient, dbExplorer } = createSankhyaIntegration();
  const reportService = new ReportService(dbExplorer);
  const dashboardService = new DashboardService(reportService);
  const crossReportService = new CrossReportService(reportService);
  const emailAlertService = new EmailAlertService();
  const syncScheduler = new SyncSchedulerService(reportService, dashboardService, emailAlertService);
  syncScheduler.start();

  app.use(
    '/api',
    apiRouter({
      reportService,
      dashboardService,
      crossReportService,
      sankhyaClient,
      syncScheduler,
      emailAlertService,
    }),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
