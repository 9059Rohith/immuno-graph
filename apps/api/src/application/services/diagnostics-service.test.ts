import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  connectorHealthListSchema,
  connectorListSchema,
  profileListSchema,
  runtimeSettingsSchema,
} from '@immunograph/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ArtifactStore } from '../artifact-store.js';
import { EmptyConnectorDiagnosticsPort, type ConnectorDiagnosticsPort } from '../ports.js';
import { DiagnosticsService } from './diagnostics-service.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  );
});

const build = {
  applicationVersion: '0.1.0',
  specificationVersion: '0.7.0-draft',
  commitSha: null,
  builtAt: null,
};

describe('DiagnosticsService', () => {
  it('returns deterministic, safe runtime diagnostics', async () => {
    const artifactRoot = await mkdtemp(join(tmpdir(), 'immunograph-artifacts-'));
    temporaryDirectories.push(artifactRoot);
    const service = new DiagnosticsService(
      { check: vi.fn().mockResolvedValue(true) },
      new EmptyConnectorDiagnosticsPort(),
      new ArtifactStore(artifactRoot),
      { demoMode: true, llmEnabled: false, build },
    );

    const runtime = await service.runtime();
    expect(runtimeSettingsSchema.parse(runtime)).toEqual(runtime);
    expect(runtime.fixtureManifest.entries.map((entry) => entry.fixtureId).sort()).toEqual([
      'covid-spike',
      'dengue',
      'influenza',
    ]);
    expect(runtime.fixtureManifest.entries.every((entry) => entry.approved)).toBe(true);
    expect(runtime.fixtureManifest.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(runtime.databaseStatus).toBe('AVAILABLE');
    expect(runtime.artifactPathStatus).toBe('AVAILABLE');
    expect(runtime).not.toHaveProperty('artifactRoot');
    expect(runtime).not.toHaveProperty('databaseUrl');
    expect(runtime).not.toHaveProperty('secrets');
    expect(runtime).not.toHaveProperty('fasta');
  });

  it('maps failed health probes without mutating state', async () => {
    const service = new DiagnosticsService(
      { check: vi.fn().mockResolvedValue(false) },
      new EmptyConnectorDiagnosticsPort(),
      { health: vi.fn().mockResolvedValue('UNAVAILABLE') },
      { demoMode: false, llmEnabled: true, build },
    );

    await expect(service.runtime()).resolves.toMatchObject({
      databaseStatus: 'UNAVAILABLE',
      artifactPathStatus: 'UNAVAILABLE',
    });
  });

  it('passes connector diagnostics through the documented schemas', async () => {
    const port: ConnectorDiagnosticsPort = {
      list: vi.fn().mockResolvedValue([
        {
          connectorId: 'mhcflurry',
          displayName: 'MHCflurry',
          methods: ['mhcflurry-presentation'],
          liveSupported: true,
          fixtureOnly: false,
          licenseStatus: 'APPROVED',
        },
      ]),
      health: vi.fn().mockResolvedValue([
        {
          connectorId: 'mhcflurry',
          health: 'AVAILABLE',
          sourceStatus: 'LIVE',
          checkedAt: '2026-07-24T00:00:00.000Z',
          message: null,
        },
      ]),
    };
    const service = new DiagnosticsService(
      { check: vi.fn() },
      port,
      { health: vi.fn() },
      { demoMode: true, llmEnabled: false, build },
    );

    expect(connectorListSchema.parse(await service.connectors())).toEqual(
      await service.connectors(),
    );
    expect(connectorHealthListSchema.parse(await service.connectorHealth())).toEqual(
      await service.connectorHealth(),
    );
  });

  it('loads and hashes both approved immutable profiles', async () => {
    const service = new DiagnosticsService(
      { check: vi.fn() },
      new EmptyConnectorDiagnosticsPort(),
      { health: vi.fn() },
      { demoMode: true, llmEnabled: false, build },
    );

    const profiles = await service.profiles();

    expect(profileListSchema.parse(profiles)).toEqual(profiles);
    expect(profiles.items).toHaveLength(2);
    expect(profiles.items.every((profile) => profile.approved)).toBe(true);
    expect(profiles.items.every((profile) => /^[a-f0-9]{64}$/.test(profile.sha256))).toBe(true);
  });
});
