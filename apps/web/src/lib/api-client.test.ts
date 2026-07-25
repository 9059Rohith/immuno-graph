import { z } from 'zod';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiRequest, apiUrl } from './api-client';

const requestId = '00000000-0000-4000-8000-000000000001';

afterEach(() => vi.unstubAllGlobals());

describe('apiRequest', () => {
  it('builds same-origin API URLs for local and production proxying', () => {
    expect(apiUrl('/projects')).toBe('http://localhost:3000/api/v1/projects');
  });

  it('returns validated envelope data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ requestId, data: { value: 'ok' } }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
      ),
    );
    await expect(
      apiRequest('/test', z.object({ value: z.literal('ok') }).strict()),
    ).resolves.toEqual({
      value: 'ok',
    });
  });

  it('maps API error envelopes to ApiError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              requestId,
              error: { code: 'API_UNAVAILABLE', message: 'Unavailable', retryable: true },
            }),
            { status: 503, headers: { 'content-type': 'application/json' } },
          ),
      ),
    );
    await expect(apiRequest('/test', z.object({}))).rejects.toMatchObject({
      code: 'API_UNAVAILABLE',
      requestId,
      retryable: true,
    });
  });

  it('rejects invalid successful payloads safely', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ requestId, data: { unexpected: 'value' } }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
      ),
    );
    await expect(
      apiRequest('/test', z.object({ value: z.string() }).strict()),
    ).rejects.toMatchObject({
      code: 'INVALID_API_RESPONSE',
    });
  });
});
