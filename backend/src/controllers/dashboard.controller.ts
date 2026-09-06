import { Request, Response } from 'express';
import { DashboardService } from '../services/DashboardService';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';

export function createDashboardController(dashboardService: DashboardService) {
  return {
    getDashboard: asyncHandler(async (_req: Request, res: Response) => {
      const data = await dashboardService.getDashboard();
      res.json({ data });
    }),

    listSuppliers: asyncHandler(async (_req: Request, res: Response) => {
      const data = await dashboardService.getDashboard();
      res.json({ data: data.fornecedores });
    }),

    getSupplier: asyncHandler(async (req: Request, res: Response) => {
      const supplier = await dashboardService.getSupplierDetail(req.params.supplier);
      if (!supplier) throw new AppError('NOT_FOUND', 404);
      res.json({ data: supplier });
    }),

    getSupplierComparison: asyncHandler(async (req: Request, res: Response) => {
      const comparison = await dashboardService.getSupplierComparison(req.params.supplier);
      res.json({ data: comparison });
    }),
  };
}
