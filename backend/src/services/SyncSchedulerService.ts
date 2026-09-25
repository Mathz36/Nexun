import { syncScheduleRepository } from '../repositories';
import { ReportService } from './ReportService';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';
import { SyncSchedule } from '../../../shared/types/sync-schedule';
import { UpdateSyncScheduleInput } from '../../../shared/schemas/sync-schedule.schemas';
import { DashboardService } from './DashboardService';
import { EmailAlertService } from './EmailAlertService';
import { Report, ReportSchedule } from '../../../shared/types/report-record';

const SCHEDULE_ID = 'default';

export class SyncSchedulerService {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly reportService: ReportService,
    private readonly dashboardService: DashboardService,
    private readonly emailAlertService: EmailAlertService,
  ) {}

  async getSchedule(): Promise<SyncSchedule> {
    const current = await syncScheduleRepository.findById(SCHEDULE_ID);
    if (current) {
      if (!current.mode || !current.dayOfMonth || !current.time) {
        const migrated = await syncScheduleRepository.update(SCHEDULE_ID, {
          mode: 'INTERVAL',
          dayOfMonth: 2,
          time: '08:00',
        });
        return migrated ?? {
          ...current,
          mode: 'INTERVAL',
          dayOfMonth: 2,
          time: '08:00',
        };
      }
      return current;
    }

    return syncScheduleRepository.insert({
      id: SCHEDULE_ID,
      enabled: false,
      mode: 'INTERVAL',
      intervalMinutes: 60,
      dayOfMonth: 2,
      time: '08:00',
      lastRunAt: null,
      lastSuccessAt: null,
      lastError: null,
    });
  }

  async updateSchedule(input: UpdateSyncScheduleInput): Promise<SyncSchedule> {
    const updated = await syncScheduleRepository.update(SCHEDULE_ID, {
      ...input,
      lastError: null,
    });
    if (!updated) throw new AppError('INTERNAL_ERROR', 500);

    this.restartTimer(updated);
    return updated;
  }

  async runNow(): Promise<{ schedule: SyncSchedule; results: Array<{ reportId: string; executionId?: string; error?: string }> }> {
    if (this.running) {
      throw new AppError('VALIDATION_ERROR', 409, undefined, 'Uma sincronização já está em andamento.');
    }

    this.running = true;
    const startedAt = new Date().toISOString();
    const schedule = await this.getSchedule();
    await syncScheduleRepository.update(SCHEDULE_ID, { lastRunAt: startedAt, lastError: null });

    try {
      const results = await this.reportService.executeAllActive();
      const errors = results.filter((result) => result.error);
      await this.dashboardService.getDashboard();
      const updated = await syncScheduleRepository.update(SCHEDULE_ID, {
        lastSuccessAt: errors.length === 0 ? new Date().toISOString() : schedule.lastSuccessAt,
        lastError: errors.length > 0 ? `${errors.length} relatório(s) falharam.` : null,
      });

      return { schedule: updated ?? schedule, results };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha na sincronização';
      await syncScheduleRepository.update(SCHEDULE_ID, { lastError: message });
      logger.error('Falha na sincronização agendada', {
        service: 'SyncSchedulerService',
        operation: 'runNow',
        errorCode: 'REPORT_EXECUTION_ERROR',
        error: message,
      });
      throw err;
    } finally {
      this.running = false;
    }
  }

  async sendAlertNow(): Promise<{ sent: boolean }> {
    const schedule = await this.getSchedule();
    const dashboard = await this.dashboardService.getDashboard();
    const comparisons = await Promise.all(
      dashboard.fornecedores
        .filter((supplier) => supplier.alerta.status === 'DIVERGENCIA')
        .map(async (supplier) => ({
          fornecedor: supplier.fornecedor,
          comparison: await this.dashboardService.getSupplierComparison(supplier.fornecedor),
        })),
    );

    const sent = await this.emailAlertService.sendDivergenceAlert(
      dashboard,
      comparisons.filter((item): item is { fornecedor: string; comparison: NonNullable<typeof item.comparison> } => Boolean(item.comparison)),
      schedule.lastRunAt,
    );
    return { sent };
  }

  start(): void {
    this.stop();
    this.timer = setInterval(() => {
      void this.checkDueReports().catch((err) => {
        logger.error('Falha ao verificar relatórios agendados', {
          service: 'SyncSchedulerService',
          operation: 'checkDueReports',
          error: err instanceof Error ? err.message : 'Erro desconhecido',
        });
      });
      void this.checkDueSupplierAlerts().catch((err) => {
        logger.error('Falha ao verificar alertas agendados por fornecedor', {
          service: 'SyncSchedulerService',
          operation: 'checkDueSupplierAlerts',
          error: err instanceof Error ? err.message : 'Erro desconhecido',
        });
      });
    }, 60_000);
    void this.checkDueReports();
    void this.checkDueSupplierAlerts();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async checkDueReports(): Promise<void> {
    const reports = await this.reportService.list();
    const dueReports = reports.filter((report) => report.ativo && this.isReportDue(report));

    for (const report of dueReports) {
      await this.runReportBySchedule(report);
    }
  }

  private async checkDueSupplierAlerts(): Promise<void> {
    const dashboard = await this.dashboardService.getDashboard();
    const supplierSchedules = typeof this.emailAlertService.getSupplierSchedules === 'function'
      ? await this.emailAlertService.getSupplierSchedules()
      : Object.fromEntries(await Promise.all(
        dashboard.fornecedores.map(async (supplier) => {
          if (typeof this.emailAlertService.getSupplierSchedule !== 'function') return [supplier.fornecedor.trim().toUpperCase(), null];
          return [supplier.fornecedor.trim().toUpperCase(), await this.emailAlertService.getSupplierSchedule(supplier.fornecedor)];
        }),
      ));

    for (const supplier of dashboard.fornecedores) {
      const key = supplier.fornecedor.trim().toUpperCase();
      const schedule = supplierSchedules[key] ?? {
        enabled: false,
        mode: 'INTERVAL',
        intervalMinutes: 1440,
        dayOfMonth: 2,
        time: '07:00',
        lastRunAt: null,
        lastSuccessAt: null,
        lastError: null,
      };

      if (!schedule.enabled || !this.isScheduleDue(schedule)) continue;

      const comparison = await this.dashboardService.getSupplierComparison(supplier.fornecedor);
      if (!comparison) continue;

      const startedAt = new Date().toISOString();
      const sent = typeof this.emailAlertService.sendSupplierDivergenceAlert === 'function'
        ? await this.emailAlertService.sendSupplierDivergenceAlert(supplier.fornecedor, dashboard, comparison, startedAt)
        : false;

      if (typeof this.emailAlertService.updateSupplierSchedule !== 'function') continue;
      const nextSchedule = {
        ...schedule,
        lastRunAt: startedAt,
        lastSuccessAt: sent ? new Date().toISOString() : schedule.lastSuccessAt,
        lastError: sent ? null : 'Falha ao enviar alerta por fornecedor',
      };
      await this.emailAlertService.updateSupplierSchedule(supplier.fornecedor, nextSchedule);
    }
  }

  private async runReportBySchedule(report: Report): Promise<void> {
    if (this.running) return;

    const schedule = this.normalizeSchedule(report.schedule);
    const startedAt = new Date().toISOString();

    try {
      await this.reportService.update(report.id, {
        schedule: { ...schedule, lastRunAt: startedAt, lastError: null },
      });
      await this.reportService.execute(report.id);

      await this.dashboardService.getDashboard();

      await this.reportService.update(report.id, {
        schedule: { ...schedule, lastRunAt: startedAt, lastSuccessAt: new Date().toISOString(), lastError: null },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha na execução do relatório agendado';
      await this.reportService.update(report.id, {
        schedule: { ...schedule, lastRunAt: startedAt, lastSuccessAt: schedule.lastSuccessAt, lastError: message },
      });
      logger.error('Falha ao executar relatório agendado', {
        service: 'SyncSchedulerService',
        operation: 'runReportBySchedule',
        reportId: report.id,
        error: message,
      });
    }
  }

  private isReportDue(report: Report): boolean {
    const schedule = this.normalizeSchedule(report.schedule);
    return this.isScheduleDue(schedule);
  }

  private isScheduleDue(schedule: Pick<ReportSchedule, 'enabled' | 'mode' | 'intervalMinutes' | 'dayOfMonth' | 'time' | 'lastRunAt'>): boolean {
    if (!schedule.enabled) return false;

    const now = new Date();
    const [hours, minutes] = schedule.time.split(':').map(Number);

    if (schedule.mode === 'MONTHLY') {
      if (now.getDate() !== schedule.dayOfMonth) return false;
      if (now.getHours() < hours || (now.getHours() === hours && now.getMinutes() < minutes)) return false;
      if (!schedule.lastRunAt) return true;
      const lastRun = new Date(schedule.lastRunAt);
      return lastRun.getFullYear() !== now.getFullYear() || lastRun.getMonth() !== now.getMonth();
    }

    const timeMinutes = hours * 60 + minutes;
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    if (nowMinutes < timeMinutes) return false;

    if (schedule.intervalMinutes >= 1440) {
      if (!schedule.lastRunAt) return true;
      const lastRun = new Date(schedule.lastRunAt);
      const sameDay = lastRun.toDateString() === now.toDateString();
      return !sameDay;
    }

    const intervalMs = schedule.intervalMinutes * 60_000;
    if (!schedule.lastRunAt) return true;
    const lastRun = new Date(schedule.lastRunAt);
    return now.getTime() - lastRun.getTime() >= intervalMs;
  }

  private normalizeSchedule(schedule?: Partial<ReportSchedule> | null): ReportSchedule {
    return {
      enabled: false,
      mode: 'INTERVAL',
      intervalMinutes: 60,
      dayOfMonth: 2,
      time: '08:00',
      lastRunAt: null,
      lastSuccessAt: null,
      lastError: null,
      ...schedule,
    };
  }

  private restartTimer(schedule: SyncSchedule): void {
    this.stop();
    if (!schedule.enabled) return;

    if (schedule.mode === 'MONTHLY') {
      this.timer = setInterval(() => {
        if (this.isMonthlyDue(schedule)) void this.runNow().catch(() => undefined);
      }, 30_000);
      return;
    }

    this.timer = setInterval(() => {
      void this.runNow().catch(() => undefined);
    }, schedule.intervalMinutes * 60_000);
  }

  private isMonthlyDue(schedule: SyncSchedule): boolean {
    const now = new Date();
    const [hours, minutes] = schedule.time.split(':').map(Number);
    if (now.getDate() !== schedule.dayOfMonth) return false;
    if (now.getHours() < hours || (now.getHours() === hours && now.getMinutes() < minutes)) {
      return false;
    }

    if (!schedule.lastRunAt) return true;
    const lastRun = new Date(schedule.lastRunAt);
    return lastRun.getFullYear() !== now.getFullYear() || lastRun.getMonth() !== now.getMonth();
  }
}
