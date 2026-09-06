import type { Report } from '../../../shared/types/report-record';
import type { ComparisonResult } from '../../../shared/types/comparison';
import type { SyncSchedule } from '../../../shared/types/sync-schedule';

/**
 * Cliente HTTP fino para a API própria do backend.
 * O frontend NUNCA chama a Sankhya diretamente (Seção 65) — apenas esta API.
 */
const BASE_URL = '/api';

interface ApiEnvelope<T> {
  data: T;
}

interface ApiErrorEnvelope {
  error: { code: string; message: string; details?: unknown };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorEnvelope | null;
    const message = body?.error?.message ?? `Erro ao chamar ${path} (HTTP ${response.status})`;
    throw new Error(message);
  }

  if (response.status === 204) return undefined as T;

  const body = (await response.json()) as ApiEnvelope<T>;
  return body.data;
}

export const api = {
  reports: {
    list: () => request<Report[]>('/reports'),
    getById: (id: string) => request<Report>(`/reports/${id}`),
    create: (input: Partial<Report>) =>
      request<Report>('/reports', { method: 'POST', body: JSON.stringify(input) }),
    update: (id: string, input: Partial<Report>) =>
      request<Report>(`/reports/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
    remove: (id: string) => request<void>(`/reports/${id}`, { method: 'DELETE' }),
    testQuery: (query: string, reportId?: string) =>
      request<{
        columns: string[];
        sampleRows: unknown[];
        totalRows: number;
        missingColumns: string[];
        valid: boolean;
      }>(reportId ? `/reports/${reportId}/test` : '/reports/test', {
        method: 'POST',
        body: JSON.stringify({ query }),
      }),
    execute: (id: string) =>
      request<{ executionId: string; recordCount: number }>(`/reports/${id}/execute`, {
        method: 'POST',
      }),
    executeAll: () =>
      request<Array<{ reportId: string; executionId?: string; error?: string }>>(
        '/reports/execute-all',
        { method: 'POST' },
      ),
  },

  dashboard: {
    get: () => request<unknown>('/dashboard'),
    listSuppliers: () => request<unknown[]>('/dashboard/suppliers'),
    getSupplier: (fornecedor: string) =>
      request<unknown>(`/dashboard/suppliers/${encodeURIComponent(fornecedor)}`),
    getSupplierComparison: (fornecedor: string) =>
      request<ComparisonResult | null>(
        `/dashboard/suppliers/${encodeURIComponent(fornecedor)}/comparison`,
      ),
  },

  comparisons: {
    create: (input: { fornecedor: string; reportIds: string[]; tolerancia?: number }) =>
      request<ComparisonResult>('/comparisons', { method: 'POST', body: JSON.stringify(input) }),
    getById: (id: string) => request<ComparisonResult>(`/comparisons/${id}`),
    listReportsForSupplier: (fornecedor: string) =>
      request<Report[]>(`/comparisons/reports/by-supplier/${encodeURIComponent(fornecedor)}`),
  },

  executions: {
    list: (reportId?: string) =>
      request<unknown[]>(reportId ? `/executions?reportId=${reportId}` : '/executions'),
  },

  health: {
    check: () => request<{ status: string }>('/health'),
    sankhya: () => request<{ ok: boolean; message: string }>('/health/sankhya'),
  },

  sync: {
    get: () => request<SyncSchedule>('/sync'),
    update: (input: {
      enabled: boolean;
      mode: 'INTERVAL' | 'MONTHLY';
      intervalMinutes: number;
      dayOfMonth: number;
      time: string;
    }) =>
      request<SyncSchedule>('/sync', { method: 'PUT', body: JSON.stringify(input) }),
    runNow: () =>
      request<{ schedule: SyncSchedule; results: Array<{ reportId: string; error?: string }> }>(
        '/sync/run-now',
        { method: 'POST' },
      ),
  },

  emailAlert: {
    get: () => request<any>('/email-alert'),
    update: (input: { enabled: boolean; senderEmail: string; recipientEmail: string; password?: string }) =>
      request<any>('/email-alert', { method: 'PUT', body: JSON.stringify(input) }),
    test: () => request<{ ok: boolean }>('/email-alert/test', { method: 'POST' }),
    sendNow: () => request<{ sent: boolean }>('/email-alert/send-now', { method: 'POST' }),
  },
};
