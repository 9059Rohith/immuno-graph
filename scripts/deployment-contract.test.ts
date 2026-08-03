import { describe, expect, it } from 'vitest';

import {
  validateApiDockerfile,
  validateFreeRenderBlueprint,
  validateMcpDockerfile,
} from './deployment-contract.mjs';

describe('deployment contract', () => {
  it('rejects an API runtime whose curl health probe has no curl binary', () => {
    const issues = validateApiDockerfile(`
FROM node:20-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends openssl
HEALTHCHECK CMD curl -fsS http://127.0.0.1:3000/health/ready || exit 1
`);

    expect(issues).toContain('API runtime health probe requires curl to be installed');
  });

  it('accepts an API runtime that installs its health-probe binary', () => {
    const issues = validateApiDockerfile(`
FROM node:20-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends openssl curl
HEALTHCHECK CMD curl -fsS http://127.0.0.1:3000/health/ready || exit 1
`);

    expect(issues).not.toContain('API runtime health probe requires curl to be installed');
  });

  it('rejects optional scientific-tool downloads in the deterministic MCP image', () => {
    const issues = validateMcpDockerfile(`
FROM node:20-bookworm-slim AS runtime
RUN curl -fsSL https://downloads.example/tool.tar.gz -o /tmp/tool.tar.gz
ENV IEDB_LIVE_ENABLED=false
`);

    expect(issues).toContain(
      'MCP runtime must not download optional scientific tools during the public-demo build',
    );
  });

  it('rejects a Render Blueprint that requires a paid service or persistent disk', () => {
    const issues = validateFreeRenderBlueprint(`
services:
  - type: web
    name: immunograph-api
    runtime: docker
    plan: starter
    disk:
      name: immunograph-data
      mountPath: /data
      sizeGB: 1
`);

    expect(issues).toContain(
      'Free Render Blueprint must use free services without persistent disks',
    );
  });
});
