import { describe, expect, it } from 'vitest';
import { NormalizationService } from '../NormalizationService';

const columns = ['FORNECEDOR', 'OPERACAO', 'NF', 'VLR_LIQUIDO', 'VLR_BRUTO', 'QUANTIDADE'];

describe('NormalizationService', () => {
  const service = new NormalizationService();

  it('detecta coluna obrigatória ausente', () => {
    const missing = service.findMissingRequiredColumns(['FORNECEDOR', 'NF']);
    expect(missing).toContain('OPERACAO');
    expect(missing).toContain('VLR_LIQUIDO');
  });

  it('não acusa colunas ausentes quando o contrato é respeitado (case-insensitive)', () => {
    const missing = service.findMissingRequiredColumns([
      'fornecedor',
      'operacao',
      'nf',
      'vlr_liquido',
      'vlr_bruto',
      'quantidade',
    ]);
    expect(missing).toHaveLength(0);
  });

  it('converte string numérica com separador decimal BR', () => {
    const [record] = service.normalize({
      columns,
      rows: [['ENVU', 'Venda', '12345', '1.000,50', '1100.00', '10']],
    });
    expect(record.valorLiquido).toBeCloseTo(1000.5);
    expect(record.valorBruto).toBeCloseTo(1100);
  });

  it('trata valores null e strings vazias como zero', () => {
    const [record] = service.normalize({
      columns,
      rows: [['ENVU', 'Venda', '1', null, '', '0']],
    });
    expect(record.valorLiquido).toBe(0);
    expect(record.valorBruto).toBe(0);
  });

  it('aceita query sem VLR_BRUTO e preserva o campo como ausente', () => {
    const [record] = service.normalize({
      columns: ['FORNECEDOR', 'OPERACAO', 'NF', 'VLR_LIQUIDO', 'QUANTIDADE'],
      rows: [['ENVU', 'Venda', '1', '10', '1']],
    });
    expect(record.valorLiquido).toBe(10);
    expect(record.valorBruto).toBeNull();
  });

  it('mantém NF como string e preserva zeros à esquerda', () => {
    const [record] = service.normalize({
      columns,
      rows: [['ENVU', 'Venda', '00123', '10', '10', '1']],
    });
    expect(record.nf).toBe('00123');
    expect(typeof record.nf).toBe('string');
  });

  it('lança REPORT_INVALID_SCHEMA quando falta coluna obrigatória', () => {
    expect(() =>
      service.normalize({
        columns: ['FORNECEDOR', 'NF'],
        rows: [['ENVU', '1']],
      }),
    ).toThrow();
  });
});
