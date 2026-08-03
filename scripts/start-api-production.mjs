import { spawnSync } from 'node:child_process';

import { ensureSqliteDatabaseFile, resolveProductionPaths } from './production-paths.mjs';

const { prismaCli, schema } = resolveProductionPaths(import.meta.url);
ensureSqliteDatabaseFile(process.env.DATABASE_URL ?? 'file:./immunograph.db', schema);

const migration = spawnSync(
  process.execPath,
  [prismaCli, 'migrate', 'deploy', '--schema', schema],
  { stdio: 'inherit', env: process.env },
);
if (migration.status !== 0) {
  throw new Error(`Database migration failed with status ${String(migration.status)}`);
}

await import('../packages/database/dist/seed.js');
await import('../apps/api/dist/index.js');
