import { z } from 'zod';

/**
 * Colunas obrigatórias que TODA query cadastrada deve retornar.
 * A comparação (case-insensitive) é feita contra as colunas retornadas
 * pelo DbExplorer antes de permitir salvar um relatório.
 */
export const REQUIRED_COLUMNS = [
  'FORNECEDOR',
  'OPERACAO',
  'NF',
  'VLR_LIQUIDO',
  'QUANTIDADE',
] as const;

export const reportTypeSchema = z.string().min(1, 'Tipo é obrigatório');

export const reportScheduleSchema = z.object({
  enabled: z.boolean().default(false),
  mode: z.enum(['INTERVAL', 'MONTHLY']).default('INTERVAL'),
  intervalMinutes: z.coerce.number().int().min(1).max(1440).default(60),
  dayOfMonth: z.coerce.number().int().min(1).max(28).default(2),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário inválido. Use HH:mm.').default('08:00'),
  lastRunAt: z.string().nullable().optional(),
  lastSuccessAt: z.string().nullable().optional(),
  lastError: z.string().nullable().optional(),
});

export const createReportSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório').max(200),
  descricao: z.string().max(1000).nullable().optional(),
  fornecedor: z
    .string()
    .min(1, 'Fornecedor é obrigatório')
    .max(200)
    .transform((v) => v.trim()),
  tipo: reportTypeSchema,
  query: z.string().min(1, 'Query é obrigatória'),
  ativo: z.boolean().default(true),
  schedule: reportScheduleSchema.optional(),
});

export const updateReportSchema = createReportSchema.partial();

export const reportIdParamSchema = z.object({
  id: z.string().min(1),
});

export const testQuerySchema = z.object({
  query: z.string().min(1, 'Query é obrigatória'),
});

export const dashboardFiltersSchema = z.object({
  fornecedor: z.string().optional(),
  operacao: z.string().optional(),
  reportId: z.string().optional(),
  status: z.enum(['OK', 'DIVERGENCIA', 'SEM_COMPARACAO']).optional(),
  dataInicio: z.string().datetime().optional(),
  dataFim: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(500).default(50),
});

export const createComparisonSchema = z.object({
  fornecedor: z.string().min(1, 'Fornecedor é obrigatório'),
  reportIds: z
    .array(z.string().min(1))
    .min(2, 'Selecione ao menos dois relatórios para cruzar'),
  tolerancia: z.coerce.number().min(0).default(0),
});

export type CreateReportInput = z.infer<typeof createReportSchema>;
export type UpdateReportInput = z.infer<typeof updateReportSchema>;
export type DashboardFiltersInput = z.infer<typeof dashboardFiltersSchema>;
export type CreateComparisonInput = z.infer<typeof createComparisonSchema>;
