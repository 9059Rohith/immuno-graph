import { spawnSync } from 'node:child_process';

const prismaCli = new URL('../node_modules/prisma/build/index.js', import.meta.url);
const schema = new URL('../packages/database/prisma/schema.prisma', import.meta.url);

const migration = spawnSync(
  process.execPath,
  [prismaCli.pathname, 'migrate', 'deploy', '--schema', schema.pathname],
  { stdio: 'inherit', env: process.env },
);
if (migration.status !== 0) {
  throw new Error(`Database migration failed with status ${String(migration.status)}`);
}

await import('../packages/database/dist/seed.js');
await import('../apps/api/dist/index.js');
