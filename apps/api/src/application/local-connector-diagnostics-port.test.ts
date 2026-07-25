import { connectorHealthListSchema, connectorListSchema } from '@immunograph/shared';
import { describe, expect, it } from 'vitest';

import { LocalConnectorDiagnosticsPort } from './local-connector-diagnostics-port.js';

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
});
