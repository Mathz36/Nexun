export interface SyncSchedule {
  id: string;
  enabled: boolean;
  mode: 'INTERVAL' | 'MONTHLY';
  intervalMinutes: number;
  dayOfMonth: number;
  time: string;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
}
