import { Request, Response } from 'express';
import { ReportService } from '../services/ReportService';
import { asyncHandler } from '../utils/asyncHandler';

export function createReportController(reportService: ReportService) {
  return {
    list: asyncHandler(async (_req: Request, res: Response) => {
      const reports = await reportService.list();
      res.json({ data: reports });
    }),

    getById: asyncHandler(async (req: Request, res: Response) => {
      const report = await reportService.getById(req.params.id);
      res.json({ data: report });
    }),

    create: asyncHandler(async (req: Request, res: Response) => {
      const report = await reportService.create(req.body);
      res.status(201).json({ data: report });
    }),

    update: asyncHandler(async (req: Request, res: Response) => {
      const report = await reportService.update(req.params.id, req.body);
      res.json({ data: report });
    }),

    delete: asyncHandler(async (req: Request, res: Response) => {
      await reportService.delete(req.params.id);
      res.status(204).send();
    }),

    testQuery: asyncHandler(async (req: Request, res: Response) => {
      const preview = await reportService.testQuery(req.body.query);
      res.json({ data: preview });
    }),

    execute: asyncHandler(async (req: Request, res: Response) => {
      const result = await reportService.execute(req.params.id);
      res.json({ data: result });
    }),

    executeAll: asyncHandler(async (_req: Request, res: Response) => {
      const results = await reportService.executeAllActive();
      res.json({ data: results });
    }),
  };
}
