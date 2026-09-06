import { ReportRecord } from './report-record';

export type DivergenceType =
  | 'VALOR_LIQUIDO_DIVERGENTE'
  | 'VALOR_BRUTO_DIVERGENTE'
  | 'QUANTIDADE_DIVERGENTE'
  | 'NOTA_AUSENTE_RELATORIO_A'
  | 'NOTA_AUSENTE_RELATORIO_B';

export type RecordStatus = 'OK' | 'DIVERGENCIA' | 'AUSENTE';

/** Um "lado" de uma comparação: um relatório específico e seus registros. */
export interface ComparisonSource {
  reportId: string;
  reportName: string;
  records: ReportRecord[];
}

/** Resultado do cruzamento para uma única chave (fornecedor+nf+operacao),
 * considerando N fontes (2 ou mais relatórios). */
export interface ComparisonRowResult {
  chave: string;
  fornecedor: string;
  nf: string;
  operacao: string;
  /** Um valor por fonte/relatório, na mesma ordem enviada na requisição.
   * `null` quando a NF não existe naquela fonte. */
  valores: Array<{
    reportId: string;
    reportName: string;
    nf: string | null;
    operacao: string | null;
    valorLiquido: number | null;
    valorBruto: number | null;
    quantidade: number | null;
  }>;
  divergencias: DivergenceType[];
  status: RecordStatus;
}

export interface ComparisonSummary {
  relatorios: Array<{ reportId: string; reportName: string; totalNotas: number }>;
  notasCoincidentes: number;
  notasDivergentes: number;
  /** Contagem de notas ausentes por relatório (índice = posição na lista de fontes). */
  notasSomenteEm: Record<string, number>;
  toleranciaAplicada: number;
}

export interface ComparisonResult {
  id: string;
  fornecedor: string;
  criadoEm: string;
  resumo: ComparisonSummary;
  linhas: ComparisonRowResult[];
}

export interface SupplierAlert {
  fornecedor: string;
  temMultiplosRelatorios: boolean;
  totalDivergencias: number;
  notasAusentes: number;
  diferencaTotalValor: number;
  status: 'DIVERGENCIA' | 'OK' | 'SEM_COMPARACAO';
}
