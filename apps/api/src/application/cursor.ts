import { z } from 'zod';

import type { CandidatePageCursor, OrderedCursor } from '@immunograph/database';

import { ApplicationError } from './errors.js';

const projectCursorSchema = z
  .object({ updatedAt: z.string().datetime({ offset: true }), id: z.string().min(1) })
  .strict();
const candidateCursorSchema = z
  .object({
    rank: z.number().int().positive(),
    finalScore: z.number().finite(),
    start: z.number().int().positive(),
    id: z.string().min(1),
  })
  .strict();
const eventCursorSchema = z.object({ sequence: z.number().int().nonnegative() }).strict();

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function decode(cursor: string): unknown {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as unknown;
  } catch {
    throw new ApplicationError('INVALID_CURSOR', 400, 'The pagination cursor is invalid.');
  }
}

export function encodeProjectCursor(value: OrderedCursor): string {
  return encode({ updatedAt: value.updatedAt.toISOString(), id: value.id });
}

export function decodeProjectCursor(cursor: string): OrderedCursor {
  try {
    const parsed = projectCursorSchema.parse(decode(cursor));
    return { updatedAt: new Date(parsed.updatedAt), id: parsed.id };
  } catch (error) {
    if (error instanceof ApplicationError) throw error;
    throw new ApplicationError('INVALID_CURSOR', 400, 'The pagination cursor is invalid.');
  }
}

export function encodeCandidateCursor(value: CandidatePageCursor): string {
  return encode(value);
}

export function decodeCandidateCursor(cursor: string): CandidatePageCursor {
  try {
    return candidateCursorSchema.parse(decode(cursor));
  } catch (error) {
    if (error instanceof ApplicationError) throw error;
    throw new ApplicationError('INVALID_CURSOR', 400, 'The pagination cursor is invalid.');
  }
}

export function encodeEventCursor(sequence: number): string {
  return encode({ sequence });
}

export function decodeEventCursor(cursor: string): number {
  try {
    return eventCursorSchema.parse(decode(cursor)).sequence;
  } catch (error) {
    if (error instanceof ApplicationError) throw error;
    throw new ApplicationError('INVALID_CURSOR', 400, 'The pagination cursor is invalid.');
  }
}
