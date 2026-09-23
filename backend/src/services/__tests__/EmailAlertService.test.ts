import { beforeEach, describe, expect, it, vi } from 'vitest';
import nodemailer from 'nodemailer';
import { EmailAlertService } from '../EmailAlertService';
import { emailAlertRepository } from '../../repositories';

describe('EmailAlertService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.SMTP_HOST = 'smtp.test.local';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_SECURE = 'false';
  });

  it('não envia e-mail quando o tipo é divergência e não há divergência', async () => {
    const service = new EmailAlertService();
    const sendMail = vi.fn().mockResolvedValue({});

    vi.spyOn(emailAlertRepository, 'findById').mockResolvedValue({
      id: 'default',
      enabled: true,
      alertType: 'DIVERGENCIA',
      senderEmail: 'sender@test.com',
      recipientEmail: 'recipient@test.com',
      password: 'secret',
      lastSentAt: null,
      lastError: null,
    });
    vi.spyOn(emailAlertRepository, 'update').mockResolvedValue({
      id: 'default',
      enabled: true,
      alertType: 'DIVERGENCIA',
      senderEmail: 'sender@test.com',
      recipientEmail: 'recipient@test.com',
      password: 'secret',
      lastSentAt: null,
      lastError: null,
    });
    vi.spyOn(nodemailer, 'createTransport').mockReturnValue({
      sendMail,
      verify: vi.fn().mockResolvedValue(true),
    } as any);

    const sent = await service.sendDivergenceAlert(
      { fornecedores: [{ fornecedor: 'ENVU', alerta: { status: 'OK', totalDivergencias: 0, notasAusentes: 0, diferencaTotalValor: 0 } }] } as any,
      [],
      new Date().toISOString(),
    );

    expect(sent).toBe(false);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('envia e-mail quando o tipo é todos mesmo sem divergência', async () => {
    const service = new EmailAlertService();
    const sendMail = vi.fn().mockResolvedValue({});

    vi.spyOn(emailAlertRepository, 'findById').mockResolvedValue({
      id: 'default',
      enabled: true,
      alertType: 'TODOS',
      senderEmail: 'sender@test.com',
      recipientEmail: 'recipient@test.com',
      password: 'secret',
      lastSentAt: null,
      lastError: null,
    });
    vi.spyOn(emailAlertRepository, 'update').mockResolvedValue({
      id: 'default',
      enabled: true,
      alertType: 'TODOS',
      senderEmail: 'sender@test.com',
      recipientEmail: 'recipient@test.com',
      password: 'secret',
      lastSentAt: null,
      lastError: null,
    });
    vi.spyOn(nodemailer, 'createTransport').mockReturnValue({
      sendMail,
      verify: vi.fn().mockResolvedValue(true),
    } as any);

    const sent = await service.sendDivergenceAlert(
      { fornecedores: [{ fornecedor: 'ENVU', alerta: { status: 'OK', totalDivergencias: 0, notasAusentes: 0, diferencaTotalValor: 0 } }] } as any,
      [],
      new Date().toISOString(),
    );

    expect(sent).toBe(true);
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it('envia resumo somente quando o fornecedor está correto e não inclui linhas coincidentes em nenhum caso', async () => {
    const service = new EmailAlertService();
    const sendMail = vi.fn().mockResolvedValue({});

    vi.spyOn(emailAlertRepository, 'findById').mockResolvedValue({
      id: 'default',
      enabled: true,
      alertType: 'TODOS',
      senderEmail: 'sender@test.com',
      recipientEmail: 'recipient@test.com',
      password: 'secret',
      lastSentAt: null,
      lastError: null,
    });
    vi.spyOn(emailAlertRepository, 'update').mockResolvedValue({
      id: 'default',
      enabled: true,
      alertType: 'TODOS',
      senderEmail: 'sender@test.com',
      recipientEmail: 'recipient@test.com',
      password: 'secret',
      lastSentAt: null,
      lastError: null,
    });
    vi.spyOn(nodemailer, 'createTransport').mockReturnValue({
      sendMail,
      verify: vi.fn().mockResolvedValue(true),
    } as any);

    const comparison = {
      id: 'cmp-1',
      fornecedor: 'ENVU',
      criadoEm: new Date().toISOString(),
      resumo: {
        relatorios: [{ reportId: 'r1', reportName: 'Rel 1', totalNotas: 2 }],
        notasCoincidentes: 1,
        notasDivergentes: 0,
        notasSomenteEm: {},
        toleranciaAplicada: 0,
      },
      linhas: [
        {
          chave: 'ENVU-1-Vendas',
          fornecedor: 'ENVU',
          nf: '1',
          operacao: 'Vendas',
          valores: [{ reportId: 'r1', reportName: 'Rel 1', nf: '1', operacao: 'Vendas', valorLiquido: 100, valorBruto: 100, quantidade: 1 }],
          divergencias: [],
          status: 'OK' as const,
        },
      ],
    } as any;

    await service.sendDivergenceAlert(
      { fornecedores: [{ fornecedor: 'ENVU', vendaLiquida: 100, quantidade: 1, totalNotas: 1, alerta: { status: 'OK', totalDivergencias: 0, notasAusentes: 0, diferencaTotalValor: 0 } }] } as any,
      [{ fornecedor: 'ENVU', comparison }],
      new Date().toISOString(),
    );

    const html = sendMail.mock.calls[0][0].html;
    expect(html).toContain('Resumo: sincronização correta');
    expect(html).not.toContain('Coincidente');
    expect(html).not.toContain('Divergente');
  });
});
