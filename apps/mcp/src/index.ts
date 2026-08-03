import { loadMcpEnvironment } from './config/environment.js';
import { startMcpHttpServer } from './framework.js';
import { TOOL_GROUPS } from './tool-catalog.js';

async function bootstrap(): Promise<void> {
  const environment = loadMcpEnvironment();
  await startMcpHttpServer(
    TOOL_GROUPS.map((group) => group.controller),
    environment.HOST,
    environment.PORT,
  );
}

void bootstrap().catch((error: unknown) => {
  process.stderr.write(`MCP server failed to start: ${String(error)}\n`);
  process.exitCode = 1;
});
