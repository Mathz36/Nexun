import { z } from 'zod';

export const updateEmailAlertSchema = z.object({
  enabled: z.boolean(),
  senderEmail: z.string().email('E-mail de envio inválido'),
  recipientEmail: z.string().email('E-mail de recebimento inválido'),
  password: z.string().min(1, 'Senha é obrigatória').optional(),
});

export type UpdateEmailAlertInput = z.infer<typeof updateEmailAlertSchema>;
