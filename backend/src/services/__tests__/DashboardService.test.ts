import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardService } from '../DashboardService';
import { executionRepository, reportRepository } from '../../repositories';

describe('DashboardService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('inclui o último horário de sincronização por fornecedor', async () => {
    const reportService = {
      getLatestRecords: vi.fn().mockResolvedValue([]),
    } as any;

    const service = new DashboardService(reportService);

    vi.spyOn(reportRepository, 'findAll').mockResolvedValue([
      {
        id: 'r1',
        nome: 'Relatório A',
        descricao: null,
        fornecedor: 'ENVU',
        tipo: 'Venda',
        query: 'select 1',
        ativo: true,
        schedule: {
          enabled: true,
          mode: 'INTERVAL',
          intervalMinutes: 60,
          dayOfMonth: 1,
          time: '08:00',
          lastRunAt: null,
          lastSuccessAt: null,
          lastError: null,
        },
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
      {
        id: 'r2',
        nome: 'Relatório B',
        descricao: null,
        fornecedor: 'ENVU',
        tipo: 'EDI',
        query: 'select 2',
        ativo: true,
        schedule: {
          enabled: true,
          mode: 'INTERVAL',
          intervalMinutes: 60,
          dayOfMonth: 1,
          time: '09:00',
          lastRunAt: null,
          lastSuccessAt: null,
          lastError: null,
        },
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    ] as any);

    vi.spyOn(executionRepository, 'findBy').mockImplementation(async (predicate) => {
      const executions = [
        {
          id: 'e1',
          reportId: 'r1',
          dataHora: '2024-01-01T08:00:00.000Z',
          status: 'SUCCESS' as const,
          tempoExecucao: 100,
          quantidadeRegistros: 2,
          erro: null,
        },
        {
          id: 'e2',
          reportId: 'r2',
          dataHora: '2024-01-01T09:30:00.000Z',
          status: 'SUCCESS' as const,
          tempoExecucao: 100,
          quantidadeRegistros: 2,
          erro: null,
        },
      ];
      return executions.filter((execution) => predicate(execution));
    });

    const dashboard = await service.getDashboard();

    expect(dashboard.fornecedores).toHaveLength(1);
    expect(dashboard.fornecedores[0].ultimoHorarioSincronizacao).toBe('2024-01-01T09:30:00.000Z');
  });
});
