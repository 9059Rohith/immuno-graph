import { describe, expect, it } from 'vitest';

import { decodeProjectCursor, encodeProjectCursor } from './cursor.js';

describe('opaque API cursors', () => {
  it('round trips a project ordering cursor', () => {
    const value = { updatedAt: new Date('2026-07-24T00:00:00.000Z'), id: 'project-id' };
    expect(decodeProjectCursor(encodeProjectCursor(value))).toEqual(value);
  });

  it('rejects malformed cursors without leaking decoder errors', () => {
    expect(() => decodeProjectCursor('not-a-cursor')).toThrowError(
      expect.objectContaining({ code: 'INVALID_CURSOR', statusCode: 400 }),
    );
  });
});
