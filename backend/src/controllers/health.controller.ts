import { Request, Response } from 'express';
import { SankhyaClient } from '../integrations/sankhya/SankhyaClient';
import { asyncHandler } from '../utils/asyncHandler';

export function createHealthController(sankhyaClient: SankhyaClient) {
  return {
    health: (_req: Request, res: Response) => {
      res.json({ data: { status: 'ok', timestamp: new Date().toISOString() } });
    },

    sankhyaHealth: asyncHandler(async (_req: Request, res: Response) => {
      const result = await sankhyaClient.testConnection();
      res.status(result.ok ? 200 : 502).json({ data: result });
    }),
  };
}
