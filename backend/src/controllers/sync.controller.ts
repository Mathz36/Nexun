import { Request, Response } from 'express';
import { SyncSchedulerService } from '../services/SyncSchedulerService';
import { asyncHandler } from '../utils/asyncHandler';

export function createSyncController(scheduler: SyncSchedulerService) {
  return {
    getSchedule: asyncHandler(async (_req: Request, res: Response) => {
      res.json({ data: await scheduler.getSchedule() });
    }),

    updateSchedule: asyncHandler(async (req: Request, res: Response) => {
      res.json({ data: await scheduler.updateSchedule(req.body) });
    }),

    runNow: asyncHandler(async (_req: Request, res: Response) => {
      res.json({ data: await scheduler.runNow() });
    }),
  };
}
