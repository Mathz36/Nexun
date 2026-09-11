import { AppError } from '../utils/AppError';
import { RawColumnarResult } from '../integrations/sankhya/SankhyaAdapter';
import { ReportRecord } from '../../../shared/types/report-record';
import { REQUIRED_COLUMNS } from '../../../shared/schemas/report.schemas';

/** Nomes de coluna aceitos, normalizados (upper-case, trim) → chave interna. */
const COLUMN_ALIASES: Record<string, keyof ReportRecord> = {
  FORNECEDOR: 'fornecedor',
  OPERACAO: 'operacao',
  'OPERAÇÃO': 'operacao',
  NF: 'nf',
  VLR_LIQUIDO: 'valorLiquido',
  VLR_BRUTO: 'valorBruto',
  QUANTIDADE: 'quantidade',
};

function normalizeColumnName(col: string): string {
  return col
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

/** Converte string numérica monetária/quantidade em number, tratando
 * separador decimal, vazio e null com segurança. Nunca lança para NF. */
function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value;

  let str = String(value).trim();
  if (str === '') return 0;

  // Trata formatos "1.234,56" (pt-BR) e "1234.56" (en-US).
  const hasComma = str.includes(',');
  const hasDot = str.includes('.');
  if (hasComma && hasDot) {
    // Assume "." como separador de milhar e "," como decimal (padrão BR).
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (hasComma && !hasDot) {
    str = str.replace(',', '.');
  }

  const parsed = Number(str);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** NF sempre como string, preservando zeros à esquerda. Nunca `Number(nf)`. */
function toNfString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function toTrimmedString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

export class NormalizationService {
  /** Identifica, a partir das colunas brutas, quais colunas obrigatórias
   * estão faltando (comparação case/acento-insensitive). */
  findMissingRequiredColumns(columns: string[]): string[] {
    const normalizedIncoming = new Set(columns.map(normalizeColumnName));
    return REQUIRED_COLUMNS.filter((required) => !normalizedIncoming.has(required));
  }

  /** Lança REPORT_INVALID_SCHEMA se alguma coluna obrigatória estiver ausente. */
  assertRequiredColumns(columns: string[]): void {
    const missing = this.findMissingRequiredColumns(columns);
    if (missing.length > 0) {
      throw new AppError('REPORT_INVALID_SCHEMA', 422, { missingColumns: missing });
    }
  }

  /** Converte o resultado colunar bruto em uma lista de ReportRecord normalizados. */
  normalize(raw: RawColumnarResult): ReportRecord[] {
    this.assertRequiredColumns(raw.columns);

    // Mapa: índice da coluna bruta -> chave interna do ReportRecord.
    const columnIndexToField = new Map<number, keyof ReportRecord>();
    raw.columns.forEach((col, idx) => {
      const normalized = normalizeColumnName(col);
      const field = COLUMN_ALIASES[normalized];
      if (field) columnIndexToField.set(idx, field);
    });

    return raw.rows.map((row) => {
      const record: Partial<ReportRecord> = {};
      columnIndexToField.forEach((field, idx) => {
        const value = row[idx];
        if (field === 'nf') {
          record.nf = toNfString(value);
        } else if (field === 'fornecedor' || field === 'operacao') {
          record[field] = toTrimmedString(value);
        } else {
          record[field] = toNumber(value);
        }
      });

      return {
        fornecedor: record.fornecedor ?? '',
        operacao: record.operacao ?? '',
        nf: record.nf ?? '',
        valorLiquido: record.valorLiquido ?? 0,
        valorBruto: record.valorBruto ?? null,
        quantidade: record.quantidade ?? 0,
      };
    });
  }
}

export const normalizationService = new NormalizationService();
