/**
 * Modelo interno normalizado de um registro de relatório.
 * Independente do formato bruto retornado pela Sankhya (ou por qualquer
 * outro ERP no futuro), TUDO deve ser convertido para este formato antes
 * de circular pelo restante da aplicação.
 */
export interface ReportRecord {
  fornecedor: string;
  operacao: string;
  /** NF é sempre string. Nunca converter para number (zeros à esquerda). */
  nf: string;
  valorLiquido: number;
  valorBruto: number | null;
  quantidade: number;
}

/** Tipos de relatório suportados hoje. Novos tipos podem ser adicionados
 * livremente sem alterar a lógica de comparação/consolidação. */
export type ReportType = 'Venda' | 'EDI' | 'Outro' | (string & {});

/** Operações reconhecidas na primeira análise. Operações não hardcoded
 * são aceitas automaticamente pelo agrupamento dinâmico. */
export type OperationType =
  | 'Venda'
  | 'Vendas'
  | 'Dev. Vendas'
  | 'Bonificação'
  | 'Bonificação Ent'
  | (string & {});

export interface Report {
  id: string;
  nome: string;
  descricao: string | null;
  fornecedor: string;
  tipo: ReportType;
  query: string;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ExecutionStatus = 'SUCCESS' | 'ERROR' | 'RUNNING';

export interface ReportExecution {
  id: string;
  reportId: string;
  dataHora: string;
  status: ExecutionStatus;
  tempoExecucao: number | null;
  quantidadeRegistros: number | null;
  erro: string | null;
}

export interface StoredReportRecord extends ReportRecord {
  id: string;
  executionId: string;
}
