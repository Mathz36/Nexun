import { z } from 'zod';

export const updateSyncScheduleSchema = z.object({
  enabled: z.boolean(),
  mode: z.enum(['INTERVAL', 'MONTHLY']),
  intervalMinutes: z.coerce.number().int().min(1).max(1440),
  dayOfMonth: z.coerce.number().int().min(1).max(28),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário inválido. Use HH:mm.'),
});

export type UpdateSyncScheduleInput = z.infer<typeof updateSyncScheduleSchema>;
