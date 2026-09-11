import { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
) {
  if (err instanceof AppError) {
    logger.error(err.message, {
      service: 'http',
      operation: `${req.method} ${req.path}`,
      status: String(err.statusCode),
      errorCode: err.code,
    });
    return res.status(err.statusCode).json(err.toResponse());
  }

  logger.error('Erro não tratado', {
    service: 'http',
    operation: `${req.method} ${req.path}`,
    errorCode: 'INTERNAL_ERROR',
  });

  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Erro interno inesperado.',
    },
  });
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `Rota não encontrada: ${req.method} ${req.path}` },
  });
}
