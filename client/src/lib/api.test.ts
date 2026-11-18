import { describe, expect, it } from 'vitest';
import { ApiError, parseApiError } from './api';

describe('parseApiError', () => {
  it('reads the server error shape', async () => {
    const res = new Response(
      JSON.stringify({ error: { code: 'CONFLICT', message: 'Name already exists' } }),
      { status: 409 },
    );
    const err = await parseApiError(res);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(409);
    expect(err.code).toBe('CONFLICT');
    expect(err.message).toBe('Name already exists');
  });

  it('falls back to a generic message for non-JSON bodies', async () => {
    const err = await parseApiError(new Response('<html>Bad gateway</html>', { status: 502 }));
    expect(err.code).toBe('HTTP_ERROR');
    expect(err.message).toBe('Request failed (502)');
  });
});
