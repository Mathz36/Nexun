import { z } from 'zod';

export const supplierAlertScheduleSchema = z.object({
  enabled: z.boolean(),
  mode: z.enum(['INTERVAL', 'MONTHLY']).default('INTERVAL'),
  intervalMinutes: z.number().int().min(1).max(1440).default(1440),
  dayOfMonth: z.number().int().min(1).max(31).default(2),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário inválido'),
});

export const updateEmailAlertSchema = z.object({
  enabled: z.boolean(),
  alertType: z.enum(['DIVERGENCIA', 'TODOS']).default('DIVERGENCIA'),
  senderEmail: z.string().email('E-mail de envio inválido'),
  recipientEmail: z.string().email('E-mail de recebimento inválido'),
  password: z.string().min(1, 'Senha é obrigatória').optional(),
});

export type UpdateEmailAlertInput = z.infer<typeof updateEmailAlertSchema>;
export type SupplierAlertScheduleInput = z.infer<typeof supplierAlertScheduleSchema>;
