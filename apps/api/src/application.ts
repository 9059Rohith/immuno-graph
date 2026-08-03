import { randomUUID } from 'node:crypto';

import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';

import type { ApiEnvironment } from './config/environment.js';
import { ApiError } from './http.js';
import { registerApiRoutes } from './routes.js';
import type { RestApiServices } from './services.js';
import type { DatabaseClient } from '@immunograph/database';
import { registerAuthRoutes } from './auth.js';
import { registerStructuralBiologyRoutes } from './structural-biology.js';

interface ServiceErrorShape extends Error {
  code?: unknown;
  statusCode?: unknown;
  retryable?: unknown;
  fieldErrors?: unknown;
}

export function createApiApplication(
  environment: ApiEnvironment,
  services: RestApiServices,
  database?: DatabaseClient,
): FastifyInstance {
  const application = Fastify({
    bodyLimit: 1_100_000,
    genReqId: () => randomUUID(),
    logger: {
      level: environment.API_LOG_LEVEL,
    },
  });

  application.setErrorHandler((error, request, reply) => {
    const candidate = error as ServiceErrorShape;
    const fastifyCode = typeof candidate.code === 'string' ? candidate.code : undefined;
    const bodyTooLarge = fastifyCode === 'FST_ERR_CTP_BODY_TOO_LARGE';
    const malformedJson =
      fastifyCode === 'FST_ERR_CTP_INVALID_JSON' || fastifyCode === 'FST_ERR_CTP_INVALID_JSON_BODY';
    const known =
      error instanceof ApiError ||
      (typeof candidate.code === 'string' &&
        typeof candidate.statusCode === 'number' &&
        candidate.statusCode >= 400 &&
        candidate.statusCode <= 599);
    const statusCode = bodyTooLarge
      ? 413
      : malformedJson
        ? 400
        : known
          ? Number(candidate.statusCode)
          : 500;
    const code = bodyTooLarge
      ? 'SEQUENCE_TOO_LONG'
      : malformedJson
        ? 'MALFORMED_JSON'
        : known && typeof candidate.code === 'string'
          ? candidate.code
          : 'INTERNAL_ERROR';
    const retryable =
      known && typeof candidate.retryable === 'boolean' ? candidate.retryable : false;
    const message = bodyTooLarge
      ? 'The FASTA upload exceeds the maximum request size.'
      : malformedJson
        ? 'The request body is not valid JSON.'
        : known
          ? candidate.message
          : 'An unexpected internal error occurred.';
    const responseError = {
      code,
      message,
      retryable,
      ...(known && candidate.fieldErrors !== undefined
        ? { fieldErrors: candidate.fieldErrors }
        : {}),
    };
    request.log.error(
      { requestId: request.id, code, statusCode, method: request.method, url: request.url },
      'api.request.failed',
    );
    return reply.status(statusCode).send({ requestId: String(request.id), error: responseError });
  });

  application.setNotFoundHandler((request, reply) =>
    reply.status(404).send({
      requestId: String(request.id),
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: 'The requested API route does not exist.',
        retryable: false,
      },
    }),
  );

  application.get('/health/live', async () => ({ status: 'ok' }));
  application.get('/health/ready', async () => {
    if (database !== undefined) await database.$queryRaw`SELECT 1`;
    return { status: 'ok', service: 'immunograph-api' };
  });

  const allowedOrigins = new Set(environment.CORS_ORIGINS);
  void application.register(cors, {
    origin(origin, callback) {
      callback(null, origin !== undefined && allowedOrigins.has(origin));
    },
  });

  if (database !== undefined) {
    registerAuthRoutes(application, database, environment.NODE_ENV === 'production');
    registerStructuralBiologyRoutes(application, database, environment.ARTIFACT_ROOT);
  }

  void registerApiRoutes(application, services);

  return application;
}
