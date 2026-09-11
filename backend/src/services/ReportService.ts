import { randomUUID } from 'node:crypto';
import { reportRepository, executionRepository, recordRepository } from '../repositories';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';
import { normalizationService } from './NormalizationService';
import { SankhyaDbExplorerService } from '../integrations/sankhya/SankhyaDbExplorerService';
import {
  CreateReportInput,
  UpdateReportInput,
} from '../../../shared/schemas/report.schemas';
import { Report, ReportRecord, StoredReportRecord } from '../../../shared/types/report-record';

export interface QueryPreview {
  columns: string[];
  sampleRows: ReportRecord[];
  totalRows: number;
  missingColumns: string[];
  valid: boolean;
}

export class ReportService {
  constructor(private readonly dbExplorer: SankhyaDbExplorerService) {}

  async list(): Promise<Report[]> {
    return reportRepository.findAll();
  }

  async getById(id: string): Promise<Report> {
    const report = await reportRepository.findById(id);
    if (!report) throw new AppError('REPORT_NOT_FOUND', 404);
    return report;
  }

  async create(input: CreateReportInput): Promise<Report> {
    const now = new Date().toISOString();
    const report: Report = {
      id: randomUUID(),
      nome: input.nome,
      descricao: input.descricao ?? null,
      fornecedor: input.fornecedor,
      tipo: input.tipo,
      query: input.query,
      ativo: input.ativo ?? true,
      createdAt: now,
      updatedAt: now,
    };
    return reportRepository.insert(report);
  }

  async update(id: string, input: UpdateReportInput): Promise<Report> {
    const updated = await reportRepository.update(id, {
      ...input,
      updatedAt: new Date().toISOString(),
    } as Partial<Report>);
    if (!updated) throw new AppError('REPORT_NOT_FOUND', 404);
    return updated;
  }

  async delete(id: string): Promise<void> {
    const ok = await reportRepository.delete(id);
    if (!ok) throw new AppError('REPORT_NOT_FOUND', 404);
  }

  async setActive(id: string, ativo: boolean): Promise<Report> {
    return this.update(id, { ativo } as UpdateReportInput);
  }

  /** Executa a query "a seco" contra o DbExplorer para validação e prévia,
   * sem persistir relatório nem execução. Usado pelo botão "Testar Query". */
  async testQuery(query: string): Promise<QueryPreview> {
    const raw = await this.dbExplorer.executeQuery(query);
    const missingColumns = normalizationService.findMissingRequiredColumns(raw.columns);
    const valid = missingColumns.length === 0;

    let sampleRows: ReportRecord[] = [];
    if (valid) {
      const normalized = normalizationService.normalize(raw);
      sampleRows = normalized.slice(0, 20);
    }

    return {
      columns: raw.columns,
      sampleRows,
      totalRows: raw.rows.length,
      missingColumns,
      valid,
    };
  }

  /** Executa um relatório já cadastrado: chama a Sankhya, normaliza,
   * grava a execução e os registros normalizados. */
  async execute(reportId: string): Promise<{ executionId: string; recordCount: number }> {
    const report = await this.getById(reportId);
    const startedAt = Date.now();

    const execution = await executionRepository.insert({
      id: randomUUID(),
      reportId,
      dataHora: new Date().toISOString(),
      status: 'RUNNING',
      tempoExecucao: null,
      quantidadeRegistros: null,
      erro: null,
    });

    try {
      const raw = await this.dbExplorer.executeQuery(report.query);
      const normalized = normalizationService.normalize(raw);

      const stored: StoredReportRecord[] = normalized.map((r) => ({
        ...r,
        id: randomUUID(),
        executionId: execution.id,
      }));

      await recordRepository.insertMany(stored);

      await executionRepository.update(execution.id, {
        status: 'SUCCESS',
        tempoExecucao: Date.now() - startedAt,
        quantidadeRegistros: stored.length,
      });

      logger.info('Relatório executado com sucesso', {
        service: 'ReportService',
        operation: 'execute',
        reportId,
        executionId: execution.id,
        duration: Date.now() - startedAt,
        status: 'SUCCESS',
      });

      return { executionId: execution.id, recordCount: stored.length };
    } catch (err) {
      const message = err instanceof AppError ? err.message : 'Erro desconhecido na execução';
      const errorCode = err instanceof AppError ? err.code : 'REPORT_EXECUTION_ERROR';

      await executionRepository.update(execution.id, {
        status: 'ERROR',
        tempoExecucao: Date.now() - startedAt,
        erro: message,
      });

      logger.error('Falha ao executar relatório', {
        service: 'ReportService',
        operation: 'execute',
        reportId,
        executionId: execution.id,
        duration: Date.now() - startedAt,
        status: 'ERROR',
        errorCode,
      });

      if (err instanceof AppError) throw err;
      throw new AppError('REPORT_EXECUTION_ERROR', 500);
    }
  }

  /** Executa todos os relatórios ativos, sequencialmente por fornecedor
   * para não sobrecarregar a Sankhya com paralelismo excessivo. */
  async executeAllActive(): Promise<Array<{ reportId: string; executionId?: string; error?: string }>> {
    const reports = await reportRepository.findBy((r) => r.ativo);
    const results: Array<{ reportId: string; executionId?: string; error?: string }> = [];

    for (const report of reports) {
      try {
        const { executionId } = await this.execute(report.id);
        results.push({ reportId: report.id, executionId });
      } catch (err) {
        const message = err instanceof AppError ? err.message : 'Erro desconhecido';
        results.push({ reportId: report.id, error: message });
      }
    }

    return results;
  }

  /** Últimos registros normalizados (da execução mais recente) de um relatório. */
  async getLatestRecords(reportId: string): Promise<StoredReportRecord[]> {
    const executions = await executionRepository.findBy(
      (e) => e.reportId === reportId && e.status === 'SUCCESS',
    );
    if (executions.length === 0) return [];

    const latest = executions.reduce((a, b) => (a.dataHora > b.dataHora ? a : b));
    return recordRepository.findBy((r) => r.executionId === latest.id);
  }
}
