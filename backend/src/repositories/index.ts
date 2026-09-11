import path from 'node:path';
import { JsonRepository } from './JsonRepository';
import { Report, ReportExecution, StoredReportRecord } from '../../../shared/types/report-record';
import { ComparisonResult } from '../../../shared/types/comparison';
import { SyncSchedule } from '../../../shared/types/sync-schedule';
import { EmailAlertSettings } from '../../../shared/types/email-alert';

// Relativo ao diretório de trabalho do processo (normalmente `backend/`),
// para que dev (tsx) e produção (dist/) apontem para a mesma pasta de dados.
// Pode ser sobrescrito via variável de ambiente DATA_DIR.
const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), 'data');

export const reportRepository = new JsonRepository<Report>('reports.json', DATA_DIR);
export const executionRepository = new JsonRepository<ReportExecution>(
  'executions.json',
  DATA_DIR,
);
export const recordRepository = new JsonRepository<StoredReportRecord>(
  'records.json',
  DATA_DIR,
);
export const comparisonRepository = new JsonRepository<ComparisonResult>(
  'comparisons.json',
  DATA_DIR,
);
export const syncScheduleRepository = new JsonRepository<SyncSchedule>(
  'sync-schedule.json',
  DATA_DIR,
);
export const emailAlertRepository = new JsonRepository<EmailAlertSettings>(
  'email-alert.json',
  DATA_DIR,
);
