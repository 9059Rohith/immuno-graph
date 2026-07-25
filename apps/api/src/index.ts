import { bootstrapApi } from './bootstrap.js';
import { loadApiEnvironment } from './config/environment.js';

const environment = loadApiEnvironment();
const application = await bootstrapApi(environment);

try {
  await application.listen({ host: environment.API_HOST, port: environment.API_PORT });
} catch (error: unknown) {
  application.log.error({ error }, 'API scaffold failed to start');
  process.exitCode = 1;
}
