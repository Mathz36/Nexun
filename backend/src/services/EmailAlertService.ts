import nodemailer, { Transporter } from 'nodemailer';
import { emailAlertRepository } from '../repositories';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';
import { DashboardData } from './DashboardService';
import { UpdateEmailAlertInput } from '../../../shared/schemas/email-alert.schemas';
import { EmailAlertSettings, EmailAlertSettingsPublic } from '../../../shared/types/email-alert';
import { ComparisonResult } from '../../../shared/types/comparison';

const SETTINGS_ID = 'default';

export class EmailAlertService {
  private transporter: Transporter | null = null;

  async getSettings(): Promise<EmailAlertSettingsPublic> {
    const settings = await this.getStoredSettings();
    return this.toPublic(settings);
  }

  async updateSettings(input: UpdateEmailAlertInput): Promise<EmailAlertSettingsPublic> {
    const current = await this.getStoredSettings();
    if (input.enabled && !input.password && !current.password) {
      throw new AppError('VALIDATION_ERROR', 422, undefined, 'Informe a senha do e-mail de envio para ativar os alertas.');
    }
    const updated = await emailAlertRepository.update(SETTINGS_ID, {
      enabled: input.enabled,
      senderEmail: input.senderEmail,
      recipientEmail: input.recipientEmail,
      password: input.password || current.password,
      lastError: null,
    });
    if (!updated) throw new AppError('INTERNAL_ERROR', 500);
    this.transporter = null;
    return this.toPublic(updated);
  }

  async testConnection(): Promise<void> {
    const settings = await this.getStoredSettings();
    const transporter = this.createTransporter(settings);
    try {
      await transporter.verify();
    } catch (err) {
      throw new AppError(
        'INTERNAL_ERROR',
        502,
        undefined,
        'Não foi possível conectar ao servidor SMTP. Confira SMTP_HOST, a porta e as credenciais.',
      );
    }
  }

  async sendDivergenceAlert(
    data: DashboardData,
    comparisons: Array<{ fornecedor: string; comparison: ComparisonResult }>,
    executionAt?: string | null,
  ): Promise<boolean> {
    const settings = await this.getStoredSettings();
    if (!settings.enabled) return false;

    const suppliers = data.fornecedores.filter(
      (supplier) => supplier.alerta.status === 'DIVERGENCIA',
    );
    if (suppliers.length === 0) return false;

    const executionDate = executionAt ? new Date(executionAt) : new Date();
    const executionDateLabel = executionDate.toLocaleString('pt-BR');
    const comparisonBySupplier = new Map(comparisons.map((item) => [item.fornecedor, item.comparison]));
    const detailSections = suppliers.map((supplier) => {
      const comparison = comparisonBySupplier.get(supplier.fornecedor);
      if (!comparison) return '';
      const reportHeaders = comparison.resumo.relatorios
        .map((report) => `<th colspan="4" style="padding:12px 10px;background:#24183d;color:#d9c7ff;border-left:1px solid #4b3670;font-size:11px;letter-spacing:1px;text-transform:uppercase;">${escapeHtml(report.reportName)}</th>`)
        .join('');
      const subHeaders = comparison.resumo.relatorios
        .map(() => '<th style="padding:9px 10px;background:#18132b;color:#a99cc8;border-left:1px solid #30264c;font-size:10px;text-align:left;">NF</th><th style="padding:9px 10px;background:#18132b;color:#a99cc8;font-size:10px;text-align:left;">Operação</th><th style="padding:9px 10px;background:#18132b;color:#a99cc8;font-size:10px;text-align:left;">Líquido</th><th style="padding:9px 10px;background:#18132b;color:#a99cc8;font-size:10px;text-align:left;">Bruto</th>')
        .join('');
      const rows = comparison.linhas
        .filter((line) => line.status !== 'OK')
        .map((line) => {
          const rowBackground = line.status === 'AUSENTE' ? '#2a1524' : '#2a2110';
          const rowColor = line.status === 'AUSENTE' ? '#ff9fba' : '#ffe08a';
          const values = line.valores.map((value) => `
            <td style="padding:11px 10px;border-left:1px solid #30264c;color:#e7e2f2;font-family:Consolas,monospace;">${escapeHtml(value.nf ?? '—')}</td>
            <td style="padding:11px 10px;color:#e7e2f2;">${escapeHtml(value.operacao ?? '—')}</td>
            <td style="padding:11px 10px;color:#e7e2f2;">${value.valorLiquido === null ? '—' : formatCurrency(value.valorLiquido)}</td>
            <td style="padding:11px 10px;color:#e7e2f2;">${value.valorBruto === null ? '—' : formatCurrency(value.valorBruto)}</td>`).join('');
          return `<tr style="background:${rowBackground};border-top:1px solid #59415f;"><td style="display:none;"></td>${values}<td style="padding:11px 10px;color:#b7abc9;font-size:12px;">${escapeHtml(line.divergencias.join(', ') || 'Nota ausente')}</td><td style="padding:11px 10px;color:${rowColor};font-weight:700;white-space:nowrap;">${line.status === 'AUSENTE' ? 'Ausente' : 'Divergente'}</td></tr>`;
        })
        .join('');
      return `
        <div style="margin:28px 0 10px;padding:14px 16px;border-left:3px solid #b879ff;background:#17122b;">
          <h3 style="margin:0 0 6px;color:#f1eaff;font-size:17px;">${escapeHtml(supplier.fornecedor)}</h3>
          <p style="margin:0;color:#b9afca;font-size:13px;">${supplier.alerta.totalDivergencias} divergente(s) · ${supplier.alerta.notasAusentes} ausente(s) · diferença líquida: <strong style="color:#ffd166;">${formatCurrency(supplier.alerta.diferencaTotalValor)}</strong></p>
        </div>
        <div style="overflow-x:auto;border:1px solid #40345e;border-radius:7px;">
        <table cellpadding="0" cellspacing="0" style="width:100%;min-width:900px;border-collapse:collapse;background:#121024;color:#e7e2f2;font-family:Arial,sans-serif;font-size:13px;">
          <thead><tr>${reportHeaders}<th rowspan="2" style="padding:12px 10px;background:#24183d;color:#d9c7ff;border-left:1px solid #4b3670;font-size:11px;letter-spacing:1px;text-transform:uppercase;">Motivo</th><th rowspan="2" style="padding:12px 10px;background:#24183d;color:#d9c7ff;border-left:1px solid #4b3670;font-size:11px;letter-spacing:1px;text-transform:uppercase;">Status</th></tr><tr>${subHeaders}</tr></thead>
          <tbody>${rows || '<tr><td colspan="99" style="padding:20px;color:#57f2b0;text-align:center;">Nenhuma ocorrência detalhada.</td></tr>'}</tbody>
        </table>
        </div>`;
    }).join('');

    try {
      const transporter = this.createTransporter(settings);
      await transporter.sendMail({
        from: settings.senderEmail,
        to: settings.recipientEmail,
        subject: `Nexun: divergências encontradas na execução de ${executionDateLabel}`,
        html: `
          <div style="margin:0;background:#0b0a16;color:#e7e2f2;font-family:Arial,sans-serif;">
            <div style="max-width:1180px;margin:0 auto;padding:28px 24px 34px;">
              <div style="padding:18px 20px;border:1px solid #40345e;border-radius:8px;background:#151329;">
                <p style="margin:0 0 8px;color:#b879ff;font-family:Consolas,monospace;font-size:11px;letter-spacing:2px;text-transform:uppercase;">NEXUN / ALERT CENTER</p>
                <h2 style="margin:0;color:#ffffff;font-size:24px;">Alerta de divergências</h2>
                <p style="margin:12px 0 0;color:#b9afca;font-size:14px;line-height:1.6;">Dados encontrados na última execução da sincronização, realizada em <strong style="color:#55d6ff;">${executionDateLabel}</strong>.</p>
              </div>
              ${detailSections}
              <p style="margin:24px 0 0;color:#77718e;font-size:12px;">Resumo gerado pelo Nexun com as condições encontradas no momento da sincronização.</p>
            </div>
          </div>`,
      });
      await emailAlertRepository.update(SETTINGS_ID, {
        lastSentAt: new Date().toISOString(),
        lastError: null,
      });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao enviar alerta';
      await emailAlertRepository.update(SETTINGS_ID, { lastError: message });
      logger.error('Falha ao enviar alerta de divergência', {
        service: 'EmailAlertService',
        operation: 'sendDivergenceAlert',
        errorCode: 'INTERNAL_ERROR',
        error: message,
      });
      return false;
    }
  }

  private async getStoredSettings(): Promise<EmailAlertSettings> {
    const current = await emailAlertRepository.findById(SETTINGS_ID);
    if (current) return current;
    return emailAlertRepository.insert({
      id: SETTINGS_ID,
      enabled: false,
      senderEmail: '',
      recipientEmail: '',
      password: '',
      lastSentAt: null,
      lastError: null,
    });
  }

  private createTransporter(settings: EmailAlertSettings): Transporter {
    if (!settings.senderEmail || !settings.recipientEmail || !settings.password) {
      throw new AppError('VALIDATION_ERROR', 422, undefined, 'Configure remetente, destinatário e senha do e-mail.');
    }
    if (!process.env.SMTP_HOST) {
      throw new AppError('INTERNAL_ERROR', 500, undefined, 'SMTP_HOST não está configurado no backend.');
    }
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user: settings.senderEmail, pass: settings.password },
      });
    }
    return this.transporter;
  }

  private toPublic(settings: EmailAlertSettings): EmailAlertSettingsPublic {
    const { password, ...publicSettings } = settings;
    return { ...publicSettings, passwordConfigured: Boolean(password) };
  }
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  })[character] as string);
}
