import { Request, Response } from 'express';
import { executionRepository } from '../repositories';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';

export const executionController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const { reportId } = req.query as { reportId?: string };
    const all = reportId
      ? await executionRepository.findBy((e) => e.reportId === reportId)
      : await executionRepository.findAll();

    const sorted = [...all].sort((a, b) => (a.dataHora < b.dataHora ? 1 : -1));
    res.json({ data: sorted });
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const execution = await executionRepository.findById(req.params.id);
    if (!execution) throw new AppError('NOT_FOUND', 404);
    res.json({ data: execution });
  }),
};
