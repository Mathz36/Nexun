import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';
import { AppError } from '../utils/AppError';

type Source = 'body' | 'query' | 'params';

/** Nunca confia diretamente em dados vindos do frontend (Seção 46).
 * Valida e substitui `req[source]` pelo resultado parseado (com defaults
 * aplicados, coerções etc.), garantindo que os handlers recebam dados
 * já tipados e seguros. */
export function validate(schema: ZodSchema, source: Source = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return next(new AppError('VALIDATION_ERROR', 400, result.error.flatten()));
    }
    (req as any)[source] = result.data;
    next();
  };
}
