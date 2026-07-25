import { createHash } from 'node:crypto';

import type { FastifyRequest } from 'fastify';
import { z } from 'zod';

export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number,
    message: string,
    readonly retryable = false,
    readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function fieldErrors(error: z.ZodError): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const field = issue.path.length === 0 ? 'request' : issue.path.join('.');
    (result[field] ??= []).push(issue.message);
  }
  return result;
}

export function parseWith<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const graphBepiPolicy = result.error.issues.some(
    (issue) => issue.message === 'GRAPHBEPI_REQUIRES_FIXTURE_POLICY',
  );
  const fastaTooLarge = result.error.issues.some(
    (issue) => issue.path.join('.') === 'fasta' && issue.code === 'too_big',
  );
  if (fastaTooLarge) {
    throw new ApiError(
      'SEQUENCE_TOO_LONG',
      413,
      'The FASTA upload exceeds the maximum request size.',
      false,
      fieldErrors(result.error),
    );
  }
  if (graphBepiPolicy) {
    throw new ApiError(
      'GRAPHBEPI_REQUIRES_FIXTURE_POLICY',
      422,
      'GraphBepi is fixture-only in MVP v1 and requires a fixture-permitting fallback policy.',
      false,
      fieldErrors(result.error),
    );
  }
  throw new ApiError(
    'VALIDATION_ERROR',
    400,
    'The request did not match the documented schema.',
    false,
    fieldErrors(result.error),
  );
}

export function requestId(request: FastifyRequest): string {
  return String(request.id);
}

export class IdempotencyCoordinator {
  private readonly results = new Map<string, { fingerprint: string; result: Promise<unknown> }>();

  execute(
    namespace: string,
    key: string | undefined,
    input: Record<string, unknown>,
    operation: () => Promise<unknown>,
  ): Promise<unknown> {
    if (key === undefined) return operation();
    const storageKey = `${namespace}:${key}`;
    const fingerprint = createHash('sha256').update(JSON.stringify(input)).digest('hex');
    const existing = this.results.get(storageKey);
    if (existing !== undefined) {
      if (existing.fingerprint !== fingerprint) {
        throw new ApiError(
          'IDEMPOTENCY_KEY_REUSED',
          409,
          'The idempotency key was already used with a different request.',
        );
      }
      return existing.result;
    }
    const result = operation().catch((error: unknown) => {
      this.results.delete(storageKey);
      throw error;
    });
    this.results.set(storageKey, { fingerprint, result });
    return result;
  }
}
