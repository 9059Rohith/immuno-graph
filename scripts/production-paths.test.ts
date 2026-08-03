import { fileURLToPath } from 'node:url';
import { mkdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ensureSqliteDatabaseFile, resolveProductionPaths } from './production-paths.mjs';

describe('production startup paths', () => {
  it('converts file URLs into native paths instead of passing URL pathnames to Node', () => {
    const scriptUrl = new URL(
      'file:///C:/tmp/immunograph%20release/scripts/start-api-production.mjs',
    );

    expect(resolveProductionPaths(scriptUrl)).toEqual({
      prismaCli: fileURLToPath(new URL('../node_modules/prisma/build/index.js', scriptUrl)),
      schema: fileURLToPath(new URL('../packages/database/prisma/schema.prisma', scriptUrl)),
    });
  });

  it('creates a missing SQLite file before deploying migrations', async () => {
    const root = join(tmpdir(), `immunograph-production-db-${crypto.randomUUID()}`);
    const schema = join(root, 'prisma', 'schema.prisma');
    await mkdir(join(root, 'prisma'), { recursive: true });

    const databasePath = ensureSqliteDatabaseFile('file:./runtime/immunograph.db', schema);

    expect(databasePath).toBe(join(root, 'prisma', 'runtime', 'immunograph.db'));
    await expect(stat(databasePath)).resolves.toMatchObject({ size: 0 });
  });
});
