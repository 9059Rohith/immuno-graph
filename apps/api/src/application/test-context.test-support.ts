import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  createDatabaseClient,
  createRepositories,
  initializeDatabase,
  PrismaTransactionManager,
} from '@immunograph/database';

export async function createMigratedTestDatabase() {
  const packageRoot = resolve(import.meta.dirname, '../../../../packages/database');
  const databaseFileName = `application-service-${process.pid}-${randomUUID()}.db`;
  const databasePath = resolve(packageRoot, 'prisma', databaseFileName);
  const databaseUrl = `file:./${databaseFileName}`;
  writeFileSync(databasePath, '', { flag: 'wx' });
  execFileSync(
    process.execPath,
    [
      resolve(packageRoot, '../../node_modules/prisma/build/index.js'),
      'migrate',
      'deploy',
      '--schema',
      resolve(packageRoot, 'prisma/schema.prisma'),
    ],
    {
      cwd: packageRoot,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'pipe',
    },
  );
  const client = createDatabaseClient(databaseUrl);
  await initializeDatabase(client);
  return {
    client,
    repositories: createRepositories(client),
    transactionManager: new PrismaTransactionManager(client),
    databaseUrl,
    async cleanup() {
      await client.$disconnect();
      rmSync(databasePath, { force: true });
      rmSync(`${databasePath}-shm`, { force: true });
      rmSync(`${databasePath}-wal`, { force: true });
    },
  };
}
