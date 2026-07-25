import { describe, expect, it } from 'vitest';

import {
  ApplicationError,
  DependencyUnavailableError,
  translatePersistenceError,
} from './errors.js';

describe('application errors', () => {
  it('carries the documented transport-safe error fields', () => {
    const error = new ApplicationError('CONFIGURATION_CHANGED', 409, 'Changed');
    expect(error).toMatchObject({
      code: 'CONFIGURATION_CHANGED',
      statusCode: 409,
      message: 'Changed',
      retryable: false,
    });
  });

  it('marks absent dependencies as retryable service failures', () => {
    expect(new DependencyUnavailableError('workflow execution')).toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      statusCode: 503,
      retryable: true,
    });
  });

  it('translates known Prisma codes and preserves unknown errors', () => {
    expect(translatePersistenceError({ code: 'P2025' })).toMatchObject({
      code: 'RESOURCE_NOT_FOUND',
      statusCode: 404,
    });
    const unknown = new Error('unknown');
    expect(translatePersistenceError(unknown)).toBe(unknown);
  });
});
