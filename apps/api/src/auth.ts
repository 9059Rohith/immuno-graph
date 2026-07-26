import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

import type { DatabaseClient } from '@immunograph/database';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { ApiError } from './http.js';

const scrypt = promisify(scryptCallback);
const SESSION_COOKIE = 'immunograph_session';
const SESSION_AGE_SECONDS = 60 * 60 * 24 * 14;
const credentialsSchema = z.object({ email: z.string().email().max(254), password: z.string().min(10).max(200) }).strict();
const signUpSchema = credentialsSchema.extend({ displayName: z.string().trim().min(2).max(80) }).strict();

function parseCookies(header: string | undefined): Record<string, string> {
  if (header === undefined) return {};
  return Object.fromEntries(header.split(';').map((part) => {
    const index = part.indexOf('=');
    return index < 0 ? [part.trim(), ''] : [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1))];
  }));
}

async function passwordHash(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt.toString('base64')}:${derived.toString('base64')}`;
}

async function passwordMatches(password: string, encoded: string): Promise<boolean> {
  const [algorithm, saltText, expectedText] = encoded.split(':');
  if (algorithm !== 'scrypt' || saltText === undefined || expectedText === undefined) return false;
  const expected = Buffer.from(expectedText, 'base64');
  const actual = (await scrypt(password, Buffer.from(saltText, 'base64'), expected.length)) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
const publicUser = (user: { id: string; email: string; displayName: string }) => ({ id: user.id, email: user.email, displayName: user.displayName });

export function registerAuthRoutes(app: FastifyInstance, database: DatabaseClient, production: boolean): void {
  const cookie = (token: string, maxAge = SESSION_AGE_SECONDS) =>
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${production ? '; Secure' : ''}`;
  const createSession = async (userId: string) => {
    const token = randomBytes(32).toString('base64url');
    await database.session.create({ data: { userId, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + SESSION_AGE_SECONDS * 1000) } });
    return token;
  };
  const currentUser = (request: FastifyRequest) => getAuthenticatedUser(database, request);

  app.post('/api/v1/auth/signup', async (request, reply) => {
    const parsed = signUpSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError('VALIDATION_ERROR', 400, 'Enter a valid name, email, and password of at least 10 characters.');
    const email = parsed.data.email.trim().toLowerCase();
    if (await database.user.findUnique({ where: { email } })) throw new ApiError('EMAIL_IN_USE', 409, 'An account already exists for this email.');
    const user = await database.user.create({ data: { email, displayName: parsed.data.displayName, passwordHash: await passwordHash(parsed.data.password) } });
    reply.header('Set-Cookie', cookie(await createSession(user.id)));
    return { requestId: String(request.id), data: { user: publicUser(user) } };
  });
  app.post('/api/v1/auth/login', async (request, reply) => {
    const parsed = credentialsSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError('INVALID_CREDENTIALS', 401, 'Email or password is incorrect.');
    const user = await database.user.findUnique({ where: { email: parsed.data.email.trim().toLowerCase() } });
    if (user === null || !(await passwordMatches(parsed.data.password, user.passwordHash))) throw new ApiError('INVALID_CREDENTIALS', 401, 'Email or password is incorrect.');
    reply.header('Set-Cookie', cookie(await createSession(user.id)));
    return { requestId: String(request.id), data: { user: publicUser(user) } };
  });
  app.post('/api/v1/auth/logout', async (request, reply) => {
    const token = parseCookies(request.headers.cookie)[SESSION_COOKIE];
    if (token !== undefined) await database.session.deleteMany({ where: { tokenHash: tokenHash(token) } });
    reply.header('Set-Cookie', cookie('', 0));
    return { requestId: String(request.id), data: { success: true } };
  });
  app.get('/api/v1/auth/me', async (request) => {
    const user = await currentUser(request);
    if (user === null) throw new ApiError('AUTHENTICATION_REQUIRED', 401, 'Sign in to continue.');
    return { requestId: String(request.id), data: { user: publicUser(user) } };
  });
}

export async function getAuthenticatedUser(database: DatabaseClient, request: FastifyRequest) {
  const token = parseCookies(request.headers.cookie)[SESSION_COOKIE];
  if (token === undefined) return null;
  const session = await database.session.findUnique({ where: { tokenHash: tokenHash(token) }, include: { user: true } });
  if (session === null || session.expiresAt <= new Date()) return null;
  return session.user;
}

export async function requireAuthenticatedUser(database: DatabaseClient, request: FastifyRequest) {
  const user = await getAuthenticatedUser(database, request);
  if (user === null) throw new ApiError('AUTHENTICATION_REQUIRED', 401, 'Sign in to continue.');
  return user;
}
