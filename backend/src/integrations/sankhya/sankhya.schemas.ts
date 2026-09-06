import { z } from 'zod';

export const sankhyaAuthResponseSchema = z
  .object({
    access_token: z.string().min(1),
    expires_in: z.number().optional(),
    token_type: z.string().optional(),
  })
  .passthrough();

export const sankhyaExecuteQueryResponseSchema = z
  .object({
    status: z.string(),
    statusMessage: z.string().optional(),
    responseBody: z
      .object({
        fieldsMetadata: z.array(z.object({ name: z.string() }).passthrough()).optional(),
        rows: z.array(z.array(z.unknown())).optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type SankhyaAuthResponseParsed = z.infer<typeof sankhyaAuthResponseSchema>;
export type SankhyaExecuteQueryResponseParsed = z.infer<
  typeof sankhyaExecuteQueryResponseSchema
>;
