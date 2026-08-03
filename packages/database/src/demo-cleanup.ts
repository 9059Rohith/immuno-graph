import type { DatabaseClient } from './client.js';
import { createRepositories } from './repositories.js';

export async function cleanupExpiredDemoProjects(
  client: DatabaseClient,
  before = new Date(),
): Promise<number> {
  return createRepositories(client).projects.deleteExpiredDemoProjects(before);
}
