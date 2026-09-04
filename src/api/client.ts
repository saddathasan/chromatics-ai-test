/**
 * The single place the app talks HTTP. Every call goes through here, so swapping the mock
 * backend for a real one is a base-URL change rather than an edit to every feature.
 */
import type { Batch, Document, NormalizedRecord } from '../domain/types';

export type Page<T> = { items: T[]; total: number; page: number; pageSize: number };
export type SimState = { speed: number; failureRate: number; outage: boolean };
export type UploadedFile = { clientKey: string; name: string; size: number; mimeType: string };

/** Thrown for any non-2xx response, carrying the status so callers can tell 409 from 503. */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** Node's fetch demands an absolute URL; the browser is happy with a relative one. */
const ORIGIN = typeof location === 'undefined' ? 'http://localhost' : '';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${ORIGIN}/api${path}`, {
    ...init,
    headers: init?.body ? { 'content-type': 'application/json' } : undefined,
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    throw new ApiError(response.status, body.message ?? `Request failed (${response.status})`);
  }
  return (await response.json()) as T;
}

const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });

/** Filters as the API accepts them; the dashboard's URL search params map straight onto this. */
export type ListParams = {
  q?: string;
  status?: string[];
  review?: string[];
  type?: string[];
  batch?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
};

/** Repeats a key per value so multi-select filters survive the round trip unambiguously. */
export function toQuery(params: ListParams): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue;
    if (Array.isArray(value)) value.forEach((v) => search.append(key, String(v)));
    else search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

export const api = {
  listDocuments: (params: ListParams) => request<Page<Document>>(`/documents${toQuery(params)}`),
  getDocument: (id: string) => request<Document>(`/documents/${id}`),
  listBatches: () => request<Batch[]>('/batches'),
  getBatch: (id: string) => request<Batch>(`/batches/${id}`),
  createBatch: (name: string) => post<Batch>('/batches', { name }),
  addDocuments: (batchId: string, files: UploadedFile[]) =>
    post<{ added: number; received: number }>(`/batches/${batchId}/documents`, { files }),
  retry: (id: string) => post<Document>(`/documents/${id}/retry`),
  confirm: (id: string) => post<Document>(`/documents/${id}/confirm`),
  reject: (id: string) => post<Document>(`/documents/${id}/reject`),
  correct: (id: string, field: keyof NormalizedRecord, value: string) =>
    request<Document>(`/documents/${id}/fields/${field}`, {
      method: 'PATCH',
      body: JSON.stringify({ value }),
    }),
  retryMatching: (params: ListParams) => post<{ affected: number }>('/documents/retry', params),
  getSim: () => request<SimState>('/sim'),
  setSim: (next: Partial<SimState>) =>
    request<SimState>('/sim', { method: 'PATCH', body: JSON.stringify(next) }),
  resetSim: () => post<SimState>('/sim/reset'),
};
