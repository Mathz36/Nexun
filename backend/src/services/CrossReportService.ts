import { randomUUID } from 'node:crypto';
import { comparisonRepository, reportRepository } from '../repositories';
import { ReportService } from './ReportService';
import { comparisonService } from './ComparisonService';
import { AppError } from '../utils/AppError';
import { ComparisonResult, ComparisonSource } from '../../../shared/types/comparison';
import { CreateComparisonInput } from '../../../shared/schemas/report.schemas';
import { Report } from '../../../shared/types/report-record';

/**
 * Orquestra o fluxo de "Cruzar Relatórios" (Seção 29-35): valida que os
 * relatórios pertencem ao fornecedor informado, busca os registros mais
 * recentes de cada um, delega a comparação pura ao ComparisonService e
 * persiste o resultado para consulta posterior (GET /api/comparisons/:id).
 */
export class CrossReportService {
  constructor(private readonly reportService: ReportService) {}

  async listReportsForSupplier(fornecedor: string): Promise<Report[]> {
    return reportRepository.findBy((r: Report) => r.fornecedor === fornecedor);
  }

  async createComparison(input: CreateComparisonInput): Promise<ComparisonResult> {
    const reports = await Promise.all(
      input.reportIds.map((id: string) => this.reportService.getById(id)),
    );

    const invalid = reports.find((r: Report) => r.fornecedor !== input.fornecedor);
    if (invalid) {
      throw new AppError(
        'COMPARISON_ERROR',
        422,
        { reportId: invalid.id, expectedFornecedor: input.fornecedor },
        `O relatório "${invalid.nome}" não pertence ao fornecedor ${input.fornecedor}.`,
      );
    }

    const sources: ComparisonSource[] = await Promise.all(
      reports.map(async (report: Report) => ({
        reportId: report.id,
        reportName: report.nome,
        records: await this.reportService.getLatestRecords(report.id),
      })),
    );

    const result = comparisonService.compare(sources, input.tolerancia);
    const persisted: ComparisonResult = {
      ...result,
      id: randomUUID(),
      fornecedor: input.fornecedor,
    };

    return comparisonRepository.insert(persisted);
  }

  async getComparison(id: string): Promise<ComparisonResult> {
    const result = await comparisonRepository.findById(id);
    if (!result) throw new AppError('NOT_FOUND', 404);
    return result;
  }
}
