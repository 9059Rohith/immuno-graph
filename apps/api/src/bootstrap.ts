import { createDatabaseClient, initializeDatabase } from '@immunograph/database';

import { createApiApplication } from './application.js';
import { createServices } from './application/create-services.js';
import type { ApiEnvironment } from './config/environment.js';

export async function bootstrapApi(environment: ApiEnvironment) {
  const client = createDatabaseClient(environment.DATABASE_URL);
  await initializeDatabase(client);
  const application = createApiApplication(
    environment,
    createServices(client, environment),
    client,
  );
  application.addHook('onClose', async () => {
    await client.$disconnect();
  });
  return application;
}
