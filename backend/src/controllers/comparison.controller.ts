import { Request, Response } from 'express';
import { CrossReportService } from '../services/CrossReportService';
import { asyncHandler } from '../utils/asyncHandler';

export function createComparisonController(crossReportService: CrossReportService) {
  return {
    create: asyncHandler(async (req: Request, res: Response) => {
      const result = await crossReportService.createComparison(req.body);
      res.status(201).json({ data: result });
    }),

    getById: asyncHandler(async (req: Request, res: Response) => {
      const result = await crossReportService.getComparison(req.params.id);
      res.json({ data: result });
    }),

    listReportsForSupplier: asyncHandler(async (req: Request, res: Response) => {
      const reports = await crossReportService.listReportsForSupplier(
        req.params.fornecedor,
      );
      res.json({ data: reports });
    }),
  };
}
