import { closeSync, mkdirSync, openSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function resolveProductionPaths(scriptUrl) {
  return {
    prismaCli: fileURLToPath(new URL('../node_modules/prisma/build/index.js', scriptUrl)),
    schema: fileURLToPath(new URL('../packages/database/prisma/schema.prisma', scriptUrl)),
  };
}

export function ensureSqliteDatabaseFile(databaseUrl, schemaPath) {
  if (!databaseUrl.startsWith('file:')) return undefined;

  let sqlitePath = decodeURIComponent(databaseUrl.slice('file:'.length).split('?')[0]);
  if (process.platform === 'win32' && /^\/[A-Za-z]:\//.test(sqlitePath)) {
    sqlitePath = sqlitePath.slice(1);
  }
  const databasePath = isAbsolute(sqlitePath)
    ? sqlitePath
    : resolve(dirname(schemaPath), sqlitePath);
  mkdirSync(dirname(databasePath), { recursive: true });
  closeSync(openSync(databasePath, 'a'));
  return databasePath;
}
