import { describe, expect, it, vi } from 'vitest';
import { SyncSchedulerService } from '../SyncSchedulerService';

describe('SyncSchedulerService', () => {
  it('considera o agendamento individual do relatório quando ele está habilitado', () => {
    const service = new SyncSchedulerService(
      {} as any,
      {} as any,
      {} as any,
    );

    const now = new Date();
    const report = {
      id: 'report-1',
      nome: 'Relatório X',
      ativo: true,
      schedule: {
        enabled: true,
        mode: 'MONTHLY' as const,
        intervalMinutes: 60,
        dayOfMonth: now.getDate(),
        time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
      },
    };

    expect((service as any).isReportDue(report)).toBe(true);
  });

  it('ignora relatórios com agendamento desativado', () => {
    const service = new SyncSchedulerService(
      {} as any,
      {} as any,
      {} as any,
    );

    const report = {
      id: 'report-2',
      nome: 'Relatório Y',
      ativo: true,
      schedule: {
        enabled: false,
        mode: 'INTERVAL' as const,
        intervalMinutes: 60,
        dayOfMonth: 3,
        time: '08:00',
      },
    };

    expect((service as any).isReportDue(report)).toBe(false);
  });

  it('dispara todo dia no horário selecionado quando o intervalo é diário', () => {
    const service = new SyncSchedulerService(
      {} as any,
      {} as any,
      {} as any,
    );

    const now = new Date();
    const selectedHour = now.getHours() === 0 ? 0 : now.getHours() - 1;
    const report = {
      id: 'report-3',
      nome: 'Relatório Z',
      ativo: true,
      schedule: {
        enabled: true,
        mode: 'INTERVAL' as const,
        intervalMinutes: 1440,
        dayOfMonth: 2,
        time: `${String(selectedHour).padStart(2, '0')}:00`,
        lastRunAt: new Date(now.getTime() - 21 * 60 * 60 * 1000).toISOString(),
      },
    };

    expect((service as any).isReportDue(report)).toBe(true);
  });

  it('envia alerta quando um relatório agendado executa com divergência', async () => {
    const reportService = {
      update: vi.fn().mockResolvedValue({}),
      execute: vi.fn().mockResolvedValue({ executionId: 'exec-1', recordCount: 10 }),
    };

    const dashboardService = {
      getDashboard: vi.fn().mockResolvedValue({
        fornecedores: [{
          fornecedor: 'ENVU',
          alerta: { status: 'DIVERGENCIA', totalDivergencias: 1, notasAusentes: 0, diferencaTotalValor: 50 },
        }],
      }),
      getSupplierComparison: vi.fn().mockResolvedValue({ linhas: [{ status: 'DIVERGENCIA' }] }),
    };

    const emailAlertService = {
      sendDivergenceAlert: vi.fn().mockResolvedValue(true),
    };

    const service = new SyncSchedulerService(reportService as any, dashboardService as any, emailAlertService as any);

    await (service as any).runReportBySchedule({
      id: 'report-4',
      nome: 'Relatório W',
      ativo: true,
      schedule: {
        enabled: true,
        mode: 'INTERVAL' as const,
        intervalMinutes: 1440,
        dayOfMonth: 2,
        time: '08:00',
        lastRunAt: null,
        lastSuccessAt: null,
        lastError: null,
      },
    } as any);

    expect(emailAlertService.sendDivergenceAlert).toHaveBeenCalledTimes(1);
  });

  it('dispara alerta agendado por fornecedor quando o horário do fornecedor está devido', async () => {
    const reportService = {} as any;
    const dashboardService = {
      getDashboard: vi.fn().mockResolvedValue({
        fornecedores: [{
          fornecedor: 'MOURAGRO',
          alerta: { status: 'DIVERGENCIA', totalDivergencias: 1, notasAusentes: 0, diferencaTotalValor: 25 },
        }],
      }),
      getSupplierComparison: vi.fn().mockResolvedValue({ linhas: [{ status: 'DIVERGENCIA' }] }),
    };

    const emailAlertService = {
      getSupplierSchedule: vi.fn().mockResolvedValue({
        enabled: true,
        mode: 'INTERVAL',
        intervalMinutes: 1440,
        dayOfMonth: 2,
        time: '07:00',
        lastRunAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
        lastSuccessAt: null,
        lastError: null,
      }),
      sendSupplierDivergenceAlert: vi.fn().mockResolvedValue(true),
      updateSupplierSchedule: vi.fn().mockResolvedValue({
        enabled: true,
        mode: 'INTERVAL',
        intervalMinutes: 1440,
        dayOfMonth: 2,
        time: '07:00',
        lastRunAt: new Date().toISOString(),
        lastSuccessAt: new Date().toISOString(),
        lastError: null,
      }),
    };

    const service = new SyncSchedulerService(reportService, dashboardService as any, emailAlertService as any);

    await (service as any).checkDueSupplierAlerts();

    expect(emailAlertService.sendSupplierDivergenceAlert).toHaveBeenCalledTimes(1);
    expect(emailAlertService.sendSupplierDivergenceAlert).toHaveBeenCalledWith(
      'MOURAGRO',
      expect.any(Object),
      expect.any(Object),
      expect.any(String),
    );
  });
});
