import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { loadApiEnvironment } from './environment.js';

const originalDatabaseUrl = process.env.DATABASE_URL;

afterEach(() => {
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
});

describe('API database environment', () => {
  it('uses the same default SQLite file as migration and seed commands', async () => {
    delete process.env.DATABASE_URL;

    expect(loadApiEnvironment().DATABASE_URL).toBe('file:./immunograph.db');
    const example = await readFile(
      resolve(import.meta.dirname, '../../../../.env.example'),
      'utf8',
    );
    expect(example).toContain('DATABASE_URL=file:./immunograph.db');
  });
});
