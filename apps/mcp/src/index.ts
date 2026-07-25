import 'reflect-metadata';

import { McpApplicationFactory } from '@nitrostack/core';

import { AppModule } from './app.module.js';
import { loadMcpEnvironment } from './config/environment.js';

async function bootstrap(): Promise<void> {
  const environment = loadMcpEnvironment();
  process.env.MCP_HOST ??= environment.MCP_HOST;
  process.env.MCP_PORT ??= String(environment.MCP_PORT);

  const application = await McpApplicationFactory.create(AppModule);
  await application.start();
}

void bootstrap().catch((error: unknown) => {
  process.stderr.write(`MCP scaffold failed to start: ${String(error)}\n`);
  process.exitCode = 1;
});
