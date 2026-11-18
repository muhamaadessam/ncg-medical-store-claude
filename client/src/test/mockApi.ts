import { vi } from 'vitest';
import { json } from './fixtures';

export interface Call {
  method: string;
  path: string;
  body: unknown;
}

type Route = (call: Call) => Response | Promise<Response> | undefined;

/** Tiny fetch router for page tests: first route returning a Response wins; otherwise 404. */
export function mockApi(...routes: Route[]) {
  const calls: Call[] = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost');
    const method = (init?.method ?? 'GET').toUpperCase();
    let body: unknown = init?.body;
    if (typeof body === 'string') body = JSON.parse(body);
    const call = { method, path: url.pathname + url.search, body };
    calls.push(call);
    for (const route of routes) {
      const res = await route(call);
      if (res) return res;
    }
    return json(
      { error: { code: 'NOT_FOUND', message: `No mock for ${method} ${call.path}` } },
      404,
    );
  });
  vi.stubGlobal('fetch', fn);
  return { calls, fn };
}

export const route =
  (method: string, path: string | RegExp, respond: (call: Call) => Response) => (call: Call) =>
    call.method === method && (typeof path === 'string' ? call.path === path : path.test(call.path))
      ? respond(call)
      : undefined;
