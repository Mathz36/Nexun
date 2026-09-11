export interface EmailAlertSettings {
  id: string;
  enabled: boolean;
  senderEmail: string;
  recipientEmail: string;
  password: string;
  lastSentAt: string | null;
  lastError: string | null;
}

export interface EmailAlertSettingsPublic extends Omit<EmailAlertSettings, 'password'> {
  passwordConfigured: boolean;
}
