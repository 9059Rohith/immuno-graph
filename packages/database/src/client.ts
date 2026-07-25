import { PrismaClient } from '@prisma/client';

export type DatabaseClient = PrismaClient;

export function createDatabaseClient(databaseUrl?: string): PrismaClient {
  return new PrismaClient(
    databaseUrl === undefined ? undefined : { datasources: { db: { url: databaseUrl } } },
  );
}

export async function initializeDatabase(client: PrismaClient): Promise<void> {
  await client.$connect();
  await client.$executeRawUnsafe('PRAGMA foreign_keys = ON');
  await client.$queryRawUnsafe('PRAGMA journal_mode = WAL');
}
