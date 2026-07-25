import { spawnSync } from 'node:child_process';
import { closeSync, existsSync, openSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const prismaCli = fileURLToPath(
  new URL('../../../node_modules/prisma/build/index.js', import.meta.url),
);
const argumentsToForward = process.argv.slice(2);
const fallbackDatabaseUrl = 'file:./immunograph.db';
const databaseUrl = process.env.DATABASE_URL ?? fallbackDatabaseUrl;

if (argumentsToForward[0] === 'migrate' && argumentsToForward[1] === 'deploy') {
  const schemaFlag = argumentsToForward.indexOf('--schema');
  const forwardedSchemaPath = schemaFlag >= 0 ? argumentsToForward[schemaFlag + 1] : undefined;
  const schemaPath =
    forwardedSchemaPath !== undefined
      ? resolve(forwardedSchemaPath)
      : fileURLToPath(new URL('../prisma/schema.prisma', import.meta.url));
  const sqliteRelativePath = databaseUrl.startsWith('file:./')
    ? databaseUrl.slice('file:./'.length).split('?')[0]
    : undefined;
  if (sqliteRelativePath !== undefined && sqliteRelativePath.length > 0) {
    const databasePath = resolve(dirname(schemaPath), sqliteRelativePath);
    if (!existsSync(databasePath)) closeSync(openSync(databasePath, 'wx'));
  }
}

const result = spawnSync(process.execPath, [prismaCli, ...argumentsToForward], {
  env: { ...process.env, DATABASE_URL: databaseUrl },
  stdio: 'inherit',
});

if (result.error !== undefined) throw result.error;
process.exitCode = result.status ?? 1;
