import { describe, expect, it } from 'vitest';
import { ComparisonService } from '../ComparisonService';
import { ReportRecord } from '../../../../shared/types/report-record';
import { ComparisonSource } from '../../../../shared/types/comparison';

function rec(partial: Partial<ReportRecord>): ReportRecord {
  return {
    fornecedor: 'ENVU',
    operacao: 'Venda',
    nf: '1',
    valorLiquido: 100,
    valorBruto: 110,
    quantidade: 1,
    ...partial,
  };
}

function source(reportId: string, reportName: string, records: ReportRecord[]): ComparisonSource {
  return { reportId, reportName, records };
}

describe('ComparisonService', () => {
  const service = new ComparisonService();

  it('marca como OK quando NF é igual em ambos os relatórios (dentro da tolerância)', () => {
    const a = source('A', 'Venda', [rec({ nf: '100' })]);
    const b = source('B', 'EDI', [rec({ nf: '100' })]);

    const result = service.compare([a, b], 0);
    expect(result.linhas).toHaveLength(1);
    expect(result.linhas[0].status).toBe('OK');
    expect(result.resumo.notasCoincidentes).toBe(1);
    expect(result.resumo.notasDivergentes).toBe(0);
  });

  it('detecta VALOR_LIQUIDO_DIVERGENTE quando os valores líquidos diferem', () => {
    const a = source('A', 'Venda', [rec({ nf: '100', valorLiquido: 1000 })]);
    const b = source('B', 'EDI', [rec({ nf: '100', valorLiquido: 950 })]);

    const result = service.compare([a, b], 0);
    expect(result.linhas[0].status).toBe('DIVERGENCIA');
    expect(result.linhas[0].divergencias).toContain('VALOR_LIQUIDO_DIVERGENTE');
    expect(result.linhas[0].divergencias).not.toContain('VALOR_BRUTO_DIVERGENTE');
  });

  it('não usa valor bruto para classificar a comparação', () => {
    const a = source('A', 'Venda', [rec({ nf: '100', valorBruto: 1100 })]);
    const b = source('B', 'EDI', [rec({ nf: '100', valorBruto: 1200 })]);

    const result = service.compare([a, b], 0);
    expect(result.linhas[0].status).toBe('OK');
    expect(result.linhas[0].divergencias).not.toContain('VALOR_BRUTO_DIVERGENTE');
  });

  it('detecta QUANTIDADE_DIVERGENTE quando a quantidade difere', () => {
    const a = source('A', 'Venda', [rec({ nf: '100', quantidade: 10 })]);
    const b = source('B', 'EDI', [rec({ nf: '100', quantidade: 8 })]);

    const result = service.compare([a, b], 0);
    expect(result.linhas[0].divergencias).toContain('QUANTIDADE_DIVERGENTE');
  });

  it('detecta NF ausente apenas no relatório A ou apenas no B', () => {
    const a = source('A', 'Venda', [rec({ nf: '100' }), rec({ nf: '101' }), rec({ nf: '102' })]);
    const b = source('B', 'EDI', [rec({ nf: '100' }), rec({ nf: '101' })]);

    const result = service.compare([a, b], 0);
    const linha102 = result.linhas.find((l) => l.nf === '102')!;

    // 102 existe em A mas não em B => "ausente NO relatório B".
    expect(linha102.status).toBe('AUSENTE');
    expect(linha102.divergencias).toContain('NOTA_AUSENTE_RELATORIO_B');
    expect(result.resumo.notasSomenteEm['A']).toBe(1);
    expect(result.resumo.notasSomenteEm['B']).toBe(0);
  });

  it('detecta NF ausente no relatório A (inverso)', () => {
    const a = source('A', 'Venda', [rec({ nf: '100' })]);
    const b = source('B', 'EDI', [rec({ nf: '100' }), rec({ nf: '999' })]);

    const result = service.compare([a, b], 0);
    const linha999 = result.linhas.find((l) => l.nf === '999')!;

    // 999 existe em B mas não em A => "ausente NO relatório A".
    expect(linha999.divergencias).toContain('NOTA_AUSENTE_RELATORIO_A');
    expect(result.resumo.notasSomenteEm['B']).toBe(1);
  });

  it('respeita a tolerância monetária configurada (1000,00 vs 1000,01)', () => {
    const a = source('A', 'Venda', [rec({ nf: '1', valorLiquido: 1000.0 })]);
    const b = source('B', 'EDI', [rec({ nf: '1', valorLiquido: 1000.01 })]);

    const semTolerancia = service.compare([a, b], 0);
    expect(semTolerancia.linhas[0].status).toBe('DIVERGENCIA');

    const comTolerancia = service.compare([a, b], 0.01);
    expect(comTolerancia.linhas[0].status).toBe('OK');
  });

  it('funciona com 3 ou mais relatórios simultaneamente', () => {
    const a = source('A', 'Venda', [rec({ nf: '1', valorLiquido: 100 })]);
    const b = source('B', 'EDI', [rec({ nf: '1', valorLiquido: 100 })]);
    const c = source('C', 'Conferência', [rec({ nf: '1', valorLiquido: 120 })]);

    const result = service.compare([a, b, c], 0);
    expect(result.linhas[0].valores).toHaveLength(3);
    expect(result.linhas[0].status).toBe('DIVERGENCIA');
    expect(result.linhas[0].divergencias).toContain('VALOR_LIQUIDO_DIVERGENTE');
  });

  it('separa corretamente operações diferentes mesmo com a mesma NF', () => {
    const a = source('A', 'Venda', [
      rec({ nf: '1', operacao: 'Venda' }),
      rec({ nf: '1', operacao: 'Dev. Venda', valorLiquido: -50 }),
    ]);
    const b = source('B', 'EDI', [
      rec({ nf: '1', operacao: 'Venda' }),
      rec({ nf: '1', operacao: 'Dev. Venda', valorLiquido: -50 }),
    ]);

    const result = service.compare([a, b], 0);
    expect(result.linhas).toHaveLength(2);
    expect(result.linhas.every((l) => l.status === 'OK')).toBe(true);
  });
});
