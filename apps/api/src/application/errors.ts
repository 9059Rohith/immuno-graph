export class ApplicationError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number,
    message: string,
    readonly retryable = false,
    readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApplicationError';
  }
}

export class DependencyUnavailableError extends ApplicationError {
  constructor(capability: string) {
    super('SERVICE_UNAVAILABLE', 503, `The ${capability} capability is not configured.`, true);
    this.name = 'DependencyUnavailableError';
  }
}

export function resourceNotFound(resource: string): ApplicationError {
  return new ApplicationError(
    'RESOURCE_NOT_FOUND',
    404,
    `The requested ${resource} does not exist.`,
  );
}

export function artifactNotFound(): ApplicationError {
  return new ApplicationError('ARTIFACT_NOT_FOUND', 404, 'The requested artifact does not exist.');
}

export function translatePersistenceError(error: unknown): unknown {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? (error as { code?: unknown }).code
      : undefined;
  if (code === 'P2025') return resourceNotFound('resource');
  if (code === 'P2002') {
    return new ApplicationError('RESOURCE_CONFLICT', 409, 'The resource already exists.');
  }
  if (code === 'P2003') {
    return new ApplicationError('RESOURCE_IN_USE', 409, 'The resource is still in use.');
  }
  return error;
}
