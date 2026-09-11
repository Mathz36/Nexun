import {
  ComparisonResult,
  ComparisonRowResult,
  ComparisonSource,
  ComparisonSummary,
  DivergenceType,
  RecordStatus,
} from '../../../shared/types/comparison';
import { ReportRecord } from '../../../shared/types/report-record';

function buildKey(record: ReportRecord): string {
  return `${record.fornecedor}||${record.nf}||${record.operacao}`;
}

/** Diferença absoluta entre dois números, tratando `null` como "ausente"
 * (nunca comparado — a ausência já é tratada separadamente). */
function diverges(a: number, b: number, tolerance: number): boolean {
  return Math.abs(a - b) > tolerance;
}

/**
 * Motor de cruzamento de relatórios.
 *
 * Regras (spec seções 29-41):
 *  - Chave de comparação: FORNECEDOR + NF + OPERACAO.
 *  - Compara VLR_LIQUIDO e QUANTIDADE entre 2+ relatórios.
 *  - VLR_BRUTO é opcional e apenas retornado para visualização.
 *  - NF presente em apenas uma fonte => AUSENTE nas demais.
 *  - Tolerância monetária configurável (aplicada a valores líquido/bruto).
 *  - Implementado para N fontes desde o início (não apenas 2), usando
 *    estruturas de mapa em memória (O(n)), sem loops aninhados por NF —
 *    ver Seção 42 (performance).
 */
export class ComparisonService {
  compare(sources: ComparisonSource[], tolerance: number): ComparisonResult {
    if (sources.length < 2) {
      throw new Error('É necessário informar ao menos duas fontes para comparação.');
    }

    // key -> índice da fonte -> registro
    const byKey = new Map<string, Map<number, ReportRecord>>();

    sources.forEach((source, sourceIdx) => {
      for (const record of source.records) {
        const key = buildKey(record);
        if (!byKey.has(key)) byKey.set(key, new Map());
        // Em caso de chave duplicada dentro da mesma fonte, o último
        // registro prevalece (evita explosão de memória com duplicatas).
        byKey.get(key)!.set(sourceIdx, record);
      }
    });

    const linhas: ComparisonRowResult[] = [];
    const notasSomenteEm: Record<string, number> = {};
    sources.forEach((s) => {
      notasSomenteEm[s.reportId] = 0;
    });

    let notasCoincidentes = 0;
    let notasDivergentes = 0;

    for (const [key, recordsBySource] of byKey.entries()) {
      const [fornecedor, nf, operacao] = key.split('||');
      const divergencias: DivergenceType[] = [];

      const valores = sources.map((source, idx) => {
        const rec = recordsBySource.get(idx);
        return {
          reportId: source.reportId,
          reportName: source.reportName,
          nf: rec ? rec.nf : null,
          operacao: rec ? rec.operacao : null,
          valorLiquido: rec ? rec.valorLiquido : null,
          valorBruto: rec ? rec.valorBruto : null,
          quantidade: rec ? rec.quantidade : null,
        };
      });

      const presentIndexes = sources
        .map((_, idx) => idx)
        .filter((idx) => recordsBySource.has(idx));

      const isFullyPresent = presentIndexes.length === sources.length;

      if (!isFullyPresent) {
        // NF ausente em ao menos uma fonte.
        if (sources.length === 2) {
          // Caso clássico de 2 relatórios: A = índice 0, B = índice 1.
          if (!recordsBySource.has(0)) divergencias.push('NOTA_AUSENTE_RELATORIO_A');
          if (!recordsBySource.has(1)) divergencias.push('NOTA_AUSENTE_RELATORIO_B');
        } else {
          // 3+ fontes: sinalizamos ausência de forma genérica via status;
          // os tipos NOTA_AUSENTE_RELATORIO_A/B do spec cobrem o caso de 2
          // relatórios. Aqui ainda marcamos A quando é a primeira fonte
          // (índice 0) que falta, para manter algum sinal utilizável.
          if (!recordsBySource.has(0)) divergencias.push('NOTA_AUSENTE_RELATORIO_A');
        }

        // "Notas somente em X": presente em exatamente uma fonte.
        if (presentIndexes.length === 1) {
          const onlyIdx = presentIndexes[0];
          notasSomenteEm[sources[onlyIdx].reportId] += 1;
        }
      } else {
        // Todas as fontes têm a NF: comparar valores par a par.
        const liquidos = presentIndexes.map((i) => recordsBySource.get(i)!.valorLiquido);
        const brutos = presentIndexes.map((i) => recordsBySource.get(i)!.valorBruto);
        const quantidades = presentIndexes.map((i) => recordsBySource.get(i)!.quantidade);

        if (hasAnyDivergence(liquidos, tolerance)) {
          divergencias.push('VALOR_LIQUIDO_DIVERGENTE');
        }
        if (hasAnyDivergence(quantidades, 0)) {
          divergencias.push('QUANTIDADE_DIVERGENTE');
        }
      }

      const status: RecordStatus = !isFullyPresent
        ? 'AUSENTE'
        : divergencias.length > 0
          ? 'DIVERGENCIA'
          : 'OK';

      if (status === 'OK') notasCoincidentes += 1;
      if (status === 'DIVERGENCIA') notasDivergentes += 1;

      linhas.push({ chave: key, fornecedor, nf, operacao, valores, divergencias, status });
    }

    const summary: ComparisonSummary = {
      relatorios: sources.map((s) => ({
        reportId: s.reportId,
        reportName: s.reportName,
        totalNotas: s.records.length,
      })),
      notasCoincidentes,
      notasDivergentes,
      notasSomenteEm,
      toleranciaAplicada: tolerance,
    };

    return {
      id: '', // preenchido pelo chamador (persistência), mantido pure aqui
      fornecedor: sources[0]?.records[0]?.fornecedor ?? '',
      criadoEm: new Date().toISOString(),
      resumo: summary,
      linhas,
    };
  }
}

function hasAnyDivergence(values: number[], tolerance: number): boolean {
  if (values.length < 2) return false;
  const min = Math.min(...values);
  const max = Math.max(...values);
  return diverges(min, max, tolerance);
}

export const comparisonService = new ComparisonService();
