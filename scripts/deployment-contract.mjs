import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const API_CURL_ISSUE = 'API runtime health probe requires curl to be installed';
const MCP_DOWNLOAD_ISSUE =
  'MCP runtime must not download optional scientific tools during the public-demo build';
const FREE_RENDER_ISSUE = 'Free Render Blueprint must use free services without persistent disks';

function runtimeStage(dockerfile) {
  const start = dockerfile.search(/^FROM\s+\S+\s+AS\s+runtime\s*$/im);
  return start === -1 ? dockerfile : dockerfile.slice(start);
}

export function validateApiDockerfile(dockerfile) {
  const runtime = runtimeStage(dockerfile);
  const healthIndex = runtime.search(/^HEALTHCHECK\b/im);
  const beforeHealth = healthIndex === -1 ? runtime : runtime.slice(0, healthIndex);
  const usesCurlProbe = /^HEALTHCHECK[^\n]*\bcurl\b/im.test(runtime);
  const installsCurl = /apt-get\s+install[\s\S]*?\bcurl\b/i.test(beforeHealth);

  return usesCurlProbe && !installsCurl ? [API_CURL_ISSUE] : [];
}

export function validateMcpDockerfile(dockerfile) {
  const runtime = runtimeStage(dockerfile);
  const instructions = runtime.split(/\r?\n(?=[A-Z]+\s)/);
  const downloadsRemoteTool = instructions.some(
    (instruction) =>
      /^RUN\b/i.test(instruction) && /\bcurl\s+[\s\S]*?https?:\/\//i.test(instruction),
  );

  return downloadsRemoteTool ? [MCP_DOWNLOAD_ISSUE] : [];
}

export function validateFreeRenderBlueprint(blueprint) {
  const plans = [...blueprint.matchAll(/^\s+plan:\s*['"]?([^'"\s#]+)['"]?/gim)].map(([, plan]) =>
    plan.toLowerCase(),
  );
  const requiresPaidService = plans.some((plan) => plan !== 'free');
  const attachesPersistentDisk = /^\s{4}disk:\s*(?:#.*)?$/im.test(blueprint);

  return requiresPaidService || attachesPersistentDisk ? [FREE_RENDER_ISSUE] : [];
}

export async function checkDeploymentFiles(rootDirectory) {
  const [apiDockerfile, mcpDockerfile, renderBlueprint] = await Promise.all([
    readFile(new URL('Dockerfile.api', rootDirectory), 'utf8'),
    readFile(new URL('Dockerfile.mcp', rootDirectory), 'utf8'),
    readFile(new URL('render.yaml', rootDirectory), 'utf8'),
  ]);
  return [
    ...validateApiDockerfile(apiDockerfile),
    ...validateMcpDockerfile(mcpDockerfile),
    ...validateFreeRenderBlueprint(renderBlueprint),
  ];
}

const invokedPath = process.argv[1];
if (invokedPath !== undefined && fileURLToPath(import.meta.url) === invokedPath) {
  const rootDirectory = new URL('../', import.meta.url);
  const issues = await checkDeploymentFiles(rootDirectory);
  if (issues.length > 0) {
    for (const issue of issues) console.error(`- ${issue}`);
    process.exitCode = 1;
  } else {
    console.log('Deployment contracts are valid.');
  }
}
