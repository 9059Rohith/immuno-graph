import { apiErrorEnvelopeSchema } from '@immunograph/shared';
import { z } from 'zod';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly retryable: boolean,
    readonly status: number,
    readonly requestId?: string,
    readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function apiUrl(path: string): string {
  const base = API_BASE_URL.endsWith('/') ? API_BASE_URL : `${API_BASE_URL}/`;
  const origin = globalThis.location?.origin ?? 'http://localhost:3000';
  const absoluteBase = new URL(base, origin);
  return new URL(path.replace(/^\//, ''), absoluteBase).toString();
}

export async function apiRequest<TSchema extends z.ZodTypeAny>(
  path: string,
  schema: TSchema,
  init?: RequestInit,
): Promise<z.output<TSchema>> {
  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      ...init,
      credentials: init?.credentials ?? 'same-origin',
      headers: {
        Accept: 'application/json',
        ...(init?.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError('API_UNAVAILABLE', 'The local API is unavailable.', true, 0);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError(
      'INVALID_API_RESPONSE',
      'The API returned invalid JSON.',
      false,
      response.status,
    );
  }

  if (!response.ok) {
    const parsed = apiErrorEnvelopeSchema.safeParse(payload);
    if (!parsed.success) {
      throw new ApiError(
        'INVALID_API_RESPONSE',
        'The API returned an invalid error.',
        false,
        response.status,
      );
    }
    throw new ApiError(
      parsed.data.error.code,
      parsed.data.error.message,
      parsed.data.error.retryable,
      response.status,
      parsed.data.requestId,
      parsed.data.error.fieldErrors,
    );
  }

  const envelope = z
    .object({ requestId: z.string().uuid(), data: z.unknown() })
    .strict()
    .safeParse(payload);
  if (!envelope.success) {
    throw new ApiError(
      'INVALID_API_RESPONSE',
      'The API response did not match its contract.',
      false,
      response.status,
    );
  }
  const parsed = schema.safeParse(envelope.data.data);
  if (!parsed.success) {
    throw new ApiError(
      'INVALID_API_RESPONSE',
      'The API response did not match its contract.',
      false,
      response.status,
    );
  }
  return parsed.data;
}

export function apiJson(
  method: 'POST' | 'DELETE',
  body: unknown,
  idempotencyKey?: string,
): RequestInit {
  return {
    method,
    body: JSON.stringify(body),
    ...(idempotencyKey === undefined ? {} : { headers: { 'Idempotency-Key': idempotencyKey } }),
  };
}
