import { connectorHealthListSchema, connectorListSchema } from '@immunograph/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LocalConnectorDiagnosticsPort } from './local-connector-diagnostics-port.js';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('LocalConnectorDiagnosticsPort', () => {
  it('reports live capability separately from the available synthetic fallback', async () => {
    const port = new LocalConnectorDiagnosticsPort(() => new Date('2026-07-24T00:00:00.000Z'));
    const connectors = { items: await port.list() };
    const health = { items: await port.health() };

    expect(connectorListSchema.parse(connectors)).toEqual(connectors);
    expect(connectorHealthListSchema.parse(health)).toEqual(health);
    expect(connectors.items.find(({ connectorId }) => connectorId === 'graphbepi')).toMatchObject({
      fixtureOnly: true,
      liveSupported: false,
    });
    expect(
      health.items.every(
        ({ sourceStatus }) => sourceStatus === 'FIXTURE' || sourceStatus === 'SYNTHETIC',
      ),
    ).toBe(true);
  });

  it('reports IEDB binding and IEDB population coverage live toggles independently', async () => {
    vi.stubEnv('IEDB_LIVE_ENABLED', 'true');
    vi.stubEnv('IEDB_POPULATION_COVERAGE_ENABLED', 'false');

    const port = new LocalConnectorDiagnosticsPort(() => new Date('2026-07-24T00:00:00.000Z'));
    const health = await port.health();

    expect(health.find(({ connectorId }) => connectorId === 'iedb')).toMatchObject({
      health: 'AVAILABLE',
      sourceStatus: 'LIVE',
    });
    expect(
      health.find(({ connectorId }) => connectorId === 'iedb-population-coverage'),
    ).toMatchObject({
      health: 'DEGRADED',
      sourceStatus: 'FIXTURE',
    });
  });
});
