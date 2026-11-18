/** Error thrown for non-2xx API responses; mirrors the server's `{ error: { code, message, details? } }`. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function parseApiError(res: Response): Promise<ApiError> {
  try {
    const body: unknown = await res.json();
    const error = (body as { error?: { code?: unknown; message?: unknown; details?: unknown } })
      ?.error;
    if (error && typeof error.message === 'string') {
      return new ApiError(
        res.status,
        typeof error.code === 'string' ? error.code : 'ERROR',
        error.message,
        error.details,
      );
    }
  } catch {
    // Non-JSON body (e.g. proxy error page): fall through to a generic message.
  }
  return new ApiError(res.status, 'HTTP_ERROR', `Request failed (${res.status})`);
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Network error. Check your connection and try again.');
  }
  if (!res.ok) throw await parseApiError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** A message that is safe to show to users for any thrown value. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'Something went wrong. Please try again.';
}
