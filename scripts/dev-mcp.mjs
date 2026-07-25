import { spawn, spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const mcpRoot = join(repoRoot, 'apps', 'mcp');
const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const mcpEntryPoint = join(mcpRoot, 'dist', 'index.js');

const build = spawnSync(npmBin, ['run', 'build', '--workspace', '@immunograph/mcp'], {
  cwd: repoRoot,
  shell: process.platform === 'win32',
  stdio: 'inherit',
});

if (build.error) {
  process.stderr.write(`Failed to build MCP workspace: ${build.error.message}\n`);
  process.exit(1);
}

if (build.status !== 0) {
  process.stderr.write(`MCP workspace build exited with code ${build.status ?? 1}.\n`);
  process.exit(build.status ?? 1);
}

const child = spawn(process.execPath, [mcpEntryPoint], {
  cwd: mcpRoot,
  env: {
    ...process.env,
    NODE_ENV: process.env.NODE_ENV ?? 'development',
    MCP_TRANSPORT_TYPE: process.env.MCP_TRANSPORT_TYPE ?? 'http',
    MCP_HOST: process.env.MCP_HOST ?? process.env.HOST ?? '127.0.0.1',
    MCP_PORT: process.env.MCP_PORT ?? process.env.PORT ?? '3001',
    HOST: process.env.HOST ?? process.env.MCP_HOST ?? '127.0.0.1',
    PORT: process.env.PORT ?? process.env.MCP_PORT ?? '3001',
  },
  stdio: 'inherit',
});

child.on('error', (error) => {
  process.stderr.write(`Failed to start MCP dev server: ${error.message}\n`);
  process.exitCode = 1;
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exitCode = code ?? 0;
});
