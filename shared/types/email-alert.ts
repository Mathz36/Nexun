export type EmailAlertType = 'DIVERGENCIA' | 'TODOS';

export interface SupplierAlertSchedule {
  enabled: boolean;
  mode: 'INTERVAL' | 'MONTHLY';
  intervalMinutes: number;
  dayOfMonth: number;
  time: string;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
}

export interface EmailAlertSettings {
  id: string;
  enabled: boolean;
  alertType: EmailAlertType;
  senderEmail: string;
  recipientEmail: string;
  password: string;
  supplierSchedules?: Record<string, SupplierAlertSchedule>;
  lastSentAt: string | null;
  lastError: string | null;
}

export interface EmailAlertSettingsPublic extends Omit<EmailAlertSettings, 'password'> {
  passwordConfigured: boolean;
}
