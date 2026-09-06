import { syncScheduleRepository } from '../repositories';
import { ReportService } from './ReportService';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';
import { SyncSchedule } from '../../../shared/types/sync-schedule';
import { UpdateSyncScheduleInput } from '../../../shared/schemas/sync-schedule.schemas';
import { DashboardService } from './DashboardService';
import { EmailAlertService } from './EmailAlertService';

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
      // Migra a configuração criada antes do suporte a agendamento mensal.
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
    const schedule = await this.getSchedule();
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
      const dashboard = await this.dashboardService.getDashboard();
      const comparisons = await Promise.all(
        dashboard.fornecedores
          .filter((supplier) => supplier.alerta.status === 'DIVERGENCIA')
          .map(async (supplier) => ({
            fornecedor: supplier.fornecedor,
            comparison: await this.dashboardService.getSupplierComparison(supplier.fornecedor),
          })),
      );
      await this.emailAlertService.sendDivergenceAlert(
        dashboard,
        comparisons.filter((item): item is { fornecedor: string; comparison: NonNullable<typeof item.comparison> } => Boolean(item.comparison)),
        startedAt,
      );
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
    void this.getSchedule().then((schedule) => this.restartTimer(schedule));
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
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
