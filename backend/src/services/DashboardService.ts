import { reportRepository } from '../repositories';
import { ReportService } from './ReportService';
import { comparisonService } from './ComparisonService';
import { Report, StoredReportRecord } from '../../../shared/types/report-record';
import { ComparisonResult, SupplierAlert } from '../../../shared/types/comparison';

export interface OperationSummary {
  operacao: string;
  valorLiquido: number;
  valorBruto: number;
  quantidade: number;
  quantidadeNF: number;
}

export interface SupplierSummary {
  fornecedor: string;
  vendaLiquida: number;
  vendaBruta: number;
  devVenda: number;
  devBonificacao: number;
  bonificacao: number;
  totalNotas: number;
  quantidade: number;
  operacoes: OperationSummary[];
  relatorios: Array<{ id: string; nome: string; tipo: string; totalRegistros: number }>;
  alerta: SupplierAlert;
}

export interface DashboardTotals {
  totalFornecedores: number;
  totalNotas: number;
  totalQuantidade: number;
  valorLiquido: number;
  valorBruto: number;
  fornecedoresComDivergencia: number;
}

export interface DashboardData {
  totais: DashboardTotals;
  fornecedores: SupplierSummary[];
}

/** Tolerância padrão usada nos alertas automáticos do dashboard.
 * A tolerância específica de um cruzamento manual pode ser diferente
 * (ver Seção 34 — configurável por execução de cruzamento). */
const DEFAULT_DASHBOARD_TOLERANCE = 0.01;

export class DashboardService {
  constructor(private readonly reportService: ReportService) {}

  async getDashboard(): Promise<DashboardData> {
    const allReports = await reportRepository.findAll();
    const byFornecedor = groupBy(allReports, (r) => r.fornecedor);

    const fornecedores: SupplierSummary[] = [];
    for (const [fornecedor, reports] of byFornecedor.entries()) {
      fornecedores.push(await this.buildSupplierSummary(fornecedor, reports));
    }

    const totais: DashboardTotals = {
      totalFornecedores: fornecedores.length,
      totalNotas: fornecedores.reduce((acc, f) => acc + f.totalNotas, 0),
      totalQuantidade: fornecedores.reduce((acc, f) => acc + f.quantidade, 0),
      valorLiquido: fornecedores.reduce((acc, f) => acc + f.vendaLiquida, 0),
      valorBruto: fornecedores.reduce((acc, f) => acc + f.vendaBruta, 0),
      fornecedoresComDivergencia: fornecedores.filter((f) => f.alerta.status === 'DIVERGENCIA')
        .length,
    };

    return { totais, fornecedores };
  }

  async getSupplierDetail(fornecedor: string): Promise<SupplierSummary | null> {
    const reports = await reportRepository.findBy((r) => r.fornecedor === fornecedor);
    if (reports.length === 0) return null;
    return this.buildSupplierSummary(fornecedor, reports);
  }

  async getSupplierComparison(fornecedor: string): Promise<ComparisonResult | null> {
    const reports = await reportRepository.findBy((r) => r.fornecedor === fornecedor);
    if (reports.length < 2) return null;

    const result = comparisonService.compare(
      await Promise.all(
        reports.map(async (report) => ({
          reportId: report.id,
          reportName: report.nome,
          records: await this.reportService.getLatestRecords(report.id),
        })),
      ),
      DEFAULT_DASHBOARD_TOLERANCE,
    );

    return { ...result, fornecedor };
  }

  private async buildSupplierSummary(fornecedor: string, reports: Report[]): Promise<SupplierSummary> {
    const recordsByReport = new Map<string, StoredReportRecord[]>();
    for (const report of reports) {
      recordsByReport.set(report.id, await this.reportService.getLatestRecords(report.id));
    }

    // Consolidação usa o PRIMEIRO relatório ativo como fonte "oficial" de
    // totais (evita somar em duplicidade quando há múltiplos relatórios
    // do mesmo fornecedor representando os mesmos dados de fontes diferentes).
    const primaryReport = reports.find((r) => r.ativo) ?? reports[0];
    const primaryRecords = recordsByReport.get(primaryReport.id) ?? [];

    const operacoesMap = new Map<string, OperationSummary>();
    for (const record of primaryRecords) {
      const op = operacoesMap.get(record.operacao) ?? {
        operacao: record.operacao,
        valorLiquido: 0,
        valorBruto: 0,
        quantidade: 0,
        quantidadeNF: 0,
      };
      op.valorLiquido += record.valorLiquido;
      op.valorBruto += record.valorBruto ?? 0;
      op.quantidade += record.quantidade;
      op.quantidadeNF += 1;
      operacoesMap.set(record.operacao, op);
    }

    const operacoes = Array.from(operacoesMap.values());
    const findOp = (...names: string[]) => operacoes.find((o) => names.includes(o.operacao));

    const alerta = await this.buildAlert(fornecedor, reports, recordsByReport);

    return {
      fornecedor,
      vendaLiquida: findOp('Vendas', 'Venda')?.valorLiquido ?? 0,
      vendaBruta: findOp('Vendas', 'Venda')?.valorBruto ?? 0,
      devVenda: findOp('Dev. Vendas', 'Dev. Venda')?.valorLiquido ?? 0,
      devBonificacao:
        findOp('Bonificação Ent', 'Dev. Bonificação')?.valorLiquido ?? 0,
      bonificacao: findOp('Bonificação')?.valorLiquido ?? 0,
      totalNotas: primaryRecords.length,
      quantidade: primaryRecords.reduce((acc, r) => acc + r.quantidade, 0),
      operacoes,
      relatorios: reports.map((r) => ({
        id: r.id,
        nome: r.nome,
        tipo: r.tipo,
        totalRegistros: recordsByReport.get(r.id)?.length ?? 0,
      })),
      alerta,
    };
  }

  private async buildAlert(
    fornecedor: string,
    reports: Report[],
    recordsByReport: Map<string, StoredReportRecord[]>,
  ): Promise<SupplierAlert> {
    if (reports.length < 2) {
      return {
        fornecedor,
        temMultiplosRelatorios: false,
        totalDivergencias: 0,
        notasAusentes: 0,
        diferencaTotalValor: 0,
        status: 'SEM_COMPARACAO',
      };
    }

    const sources = reports.map((r) => ({
      reportId: r.id,
      reportName: r.nome,
      records: recordsByReport.get(r.id) ?? [],
    }));

    const result = comparisonService.compare(sources, DEFAULT_DASHBOARD_TOLERANCE);

    const notasAusentes = result.linhas.filter((l) => l.status === 'AUSENTE').length;
    const diferencaTotalValor = result.linhas.reduce((acc, linha) => {
      if (linha.status !== 'DIVERGENCIA') return acc;
      const presentes = linha.valores.filter((v) => v.valorLiquido !== null);
      if (presentes.length < 2) return acc;
      const valores = presentes.map((v) => v.valorLiquido as number);
      return acc + (Math.max(...valores) - Math.min(...valores));
    }, 0);

    return {
      fornecedor,
      temMultiplosRelatorios: true,
      totalDivergencias: result.resumo.notasDivergentes,
      notasAusentes,
      diferencaTotalValor,
      status: result.resumo.notasDivergentes > 0 || notasAusentes > 0 ? 'DIVERGENCIA' : 'OK',
    };
  }
}

function groupBy<T, K>(items: T[], keyFn: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return map;
}
