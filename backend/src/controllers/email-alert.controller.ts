import { Request, Response } from 'express';
import { EmailAlertService } from '../services/EmailAlertService';
import { SyncSchedulerService } from '../services/SyncSchedulerService';
import { asyncHandler } from '../utils/asyncHandler';

export function createEmailAlertController(
  service: EmailAlertService,
  scheduler: SyncSchedulerService,
) {
  return {
    get: asyncHandler(async (_req: Request, res: Response) => {
      res.json({ data: await service.getSettings() });
    }),
    update: asyncHandler(async (req: Request, res: Response) => {
      res.json({ data: await service.updateSettings(req.body) });
    }),
    getSupplierSchedules: asyncHandler(async (_req: Request, res: Response) => {
      res.json({ data: await service.getSupplierSchedules() });
    }),
    getSupplierSchedule: asyncHandler(async (req: Request, res: Response) => {
      const supplier = decodeURIComponent(req.params.supplier);
      res.json({ data: await service.getSupplierSchedule(supplier) });
    }),
    updateSupplierSchedule: asyncHandler(async (req: Request, res: Response) => {
      const supplier = decodeURIComponent(req.params.supplier);
      res.json({ data: await service.updateSupplierSchedule(supplier, req.body) });
    }),
    test: asyncHandler(async (_req: Request, res: Response) => {
      await service.testConnection();
      res.json({ data: { ok: true } });
    }),
    sendNow: asyncHandler(async (_req: Request, res: Response) => {
      res.json({ data: await scheduler.sendAlertNow() });
    }),
  };
}
