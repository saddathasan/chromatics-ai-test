/**
 * The HTTP surface of the simulated backend. These handlers are the contract the UI codes
 * against: replacing them with a real server means deleting this file, not touching a component.
 * Latency, transport failures and 409s on illegal transitions are all modelled here.
 */
import { HttpResponse, delay, http } from 'msw';
import { IllegalTransition, transition } from '../domain/transitions';
import type { NormalizedRecord } from '../domain/types';
import * as store from './store';

/**
 * Paths are origin-agnostic (`*\/api/...`) so the same handlers serve the browser, where the
 * app fetches relative URLs, and the test runner, where Node's fetch requires an absolute one.
 */

/** Every read is slow enough to make loading states visible without being annoying. */
const LATENCY: [number, number] = [80, 250];

const jitter = () => LATENCY[0] + Math.random() * (LATENCY[1] - LATENCY[0]);

/** The injectable outage: reads fail at the transport level so the UI's error path is real. */
function outage() {
  return store.getSim().outage
    ? HttpResponse.json({ message: 'The processing service is unavailable.' }, { status: 503 })
    : undefined;
}

function list(url: URL) {
  const values = (key: string) => url.searchParams.getAll(key).filter(Boolean);
  const one = (key: string) => url.searchParams.get(key) ?? undefined;
  return {
    q: one('q'),
    status: values('status') as store.ListQuery['status'],
    review: values('review') as store.ListQuery['review'],
    type: values('type') as store.ListQuery['type'],
    batch: one('batch'),
    sort: one('sort'),
    page: Number(one('page') ?? 1),
    pageSize: Number(one('pageSize') ?? 50),
  } satisfies store.ListQuery;
}

/** Maps a domain guard failure onto the status code a real API would return. */
function guarded(run: () => unknown) {
  try {
    return HttpResponse.json(run() as Record<string, unknown>);
  } catch (error) {
    if (error instanceof IllegalTransition) {
      return HttpResponse.json({ message: error.message }, { status: 409 });
    }
    throw error;
  }
}

const at = () => new Date().toISOString();

export const handlers = [
  http.get('*/api/batches', async () => {
    await delay(jitter());
    return outage() ?? HttpResponse.json(store.listBatches());
  }),

  http.get('*/api/batches/:id', async ({ params }) => {
    await delay(jitter());
    const failure = outage();
    if (failure) return failure;
    const batch = store.batchStats(String(params.id));
    return batch
      ? HttpResponse.json(batch)
      : HttpResponse.json({ message: 'No such batch.' }, { status: 404 });
  }),

  http.post('*/api/batches', async ({ request }) => {
    await delay(jitter());
    const body = (await request.json()) as { name?: string };
    return HttpResponse.json(store.createBatch(body.name?.trim() || 'Untitled batch'), {
      status: 201,
    });
  }),

  http.post('*/api/batches/:id/documents', async ({ params, request }) => {
    await delay(jitter());
    const body = (await request.json()) as { files: store.UploadedFile[] };
    const added = store.addDocuments(String(params.id), body.files ?? []);
    return HttpResponse.json({ added, received: body.files?.length ?? 0 }, { status: 201 });
  }),

  http.get('*/api/documents', async ({ request }) => {
    await delay(jitter());
    return outage() ?? HttpResponse.json(store.list(list(new URL(request.url))));
  }),

  http.get('*/api/documents/:id', async ({ params }) => {
    await delay(jitter());
    const failure = outage();
    if (failure) return failure;
    const doc = store.get(String(params.id));
    return doc
      ? HttpResponse.json(doc)
      : HttpResponse.json({ message: 'No such document.' }, { status: 404 });
  }),

  http.post('*/api/documents/retry', async ({ request }) => {
    await delay(jitter());
    const body = (await request.json()) as store.ListQuery;
    return HttpResponse.json({ affected: store.retryMatching(body ?? {}) });
  }),

  http.post('*/api/documents/:id/retry', async ({ params }) => {
    await delay(jitter());
    return guarded(() =>
      store.mutate(String(params.id), (doc) => transition(doc, { type: 'retry', at: at() })),
    );
  }),

  http.post('*/api/documents/:id/confirm', async ({ params }) => {
    await delay(jitter());
    return guarded(() =>
      store.mutate(String(params.id), (doc) => transition(doc, { type: 'confirm', at: at() })),
    );
  }),

  http.post('*/api/documents/:id/reject', async ({ params }) => {
    await delay(jitter());
    return guarded(() =>
      store.mutate(String(params.id), (doc) => transition(doc, { type: 'reject', at: at() })),
    );
  }),

  http.patch('*/api/documents/:id/fields/:field', async ({ params, request }) => {
    await delay(jitter());
    const body = (await request.json()) as { value: string };
    return guarded(() =>
      store.mutate(String(params.id), (doc) =>
        transition(doc, {
          type: 'correct',
          at: at(),
          field: String(params.field) as keyof NormalizedRecord,
          value: body.value,
        }),
      ),
    );
  }),

  http.get('*/api/sim', () => HttpResponse.json(store.getSim())),

  http.patch('*/api/sim', async ({ request }) => {
    const body = (await request.json()) as Partial<store.SimState>;
    return HttpResponse.json(store.setSim(body));
  }),

  http.post('*/api/sim/reset', async () => {
    store.reset();
    return HttpResponse.json(store.getSim());
  }),
];
