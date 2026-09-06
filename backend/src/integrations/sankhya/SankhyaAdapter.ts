import { AppError } from '../../utils/AppError';
import { sankhyaExecuteQueryResponseSchema } from './sankhya.schemas';

/**
 * Formato colunar genérico, independente de ERP: nomes das colunas +
 * linhas de valores posicionais. O NormalizationService (camada acima)
 * transforma isso em `ReportRecord[]`.
 */
export interface RawColumnarResult {
  columns: string[];
  rows: unknown[][];
}

/**
 * Converte a resposta bruta do DbExplorerSP.executeQuery para o formato
 * colunar genérico. Isola o "formato Sankhya" para que, se um dia outro
 * ERP for adicionado (ver Seção 62 do spec), baste escrever um adapter
 * equivalente — o restante do pipeline (normalização, comparação,
 * dashboard) não muda.
 */
export function adaptSankhyaResponse(raw: unknown): RawColumnarResult {
  const parsed = sankhyaExecuteQueryResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError('SANKHYA_INVALID_RESPONSE', 502, parsed.error.flatten());
  }

  const { status, statusMessage, responseBody } = parsed.data;

  // CONFIRMAR COM DOC OFICIAL: qual valor de `status` realmente indica sucesso.
  if (status !== '1' && status !== '0') {
    throw new AppError('SANKHYA_QUERY_ERROR', 502, { status, statusMessage });
  }

  const columns = (responseBody?.fieldsMetadata ?? []).map((f) => f.name);
  const rows = responseBody?.rows ?? [];

  if (columns.length === 0) {
    throw new AppError('SANKHYA_INVALID_RESPONSE', 502, {
      reason: 'Nenhuma coluna retornada pelo DbExplorer',
    });
  }

  return { columns, rows };
}
