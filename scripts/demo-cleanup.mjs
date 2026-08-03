import {
  cleanupExpiredDemoProjects,
  createDatabaseClient,
  initializeDatabase,
} from '../packages/database/src/index.ts';

const client = createDatabaseClient(process.env.DATABASE_URL ?? 'file:./immunograph.db');

try {
  await initializeDatabase(client);
  const deletedProjects = await cleanupExpiredDemoProjects(client);
  console.log(`Removed ${deletedProjects} expired demo workspace(s).`);
} finally {
  await client.$disconnect();
}
