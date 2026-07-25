import { describe, expect, it } from 'vitest';

import {
  EmptyConnectorDiagnosticsPort,
  UnavailableReportGenerationPort,
  UnavailableWorkflowExecutionPort,
} from './ports.js';

describe('default capability ports', () => {
  it('fails workflow and report commands as genuine unavailable dependencies', async () => {
    await expect(new UnavailableWorkflowExecutionPort().assertAvailable()).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      statusCode: 503,
    });
    await expect(new UnavailableReportGenerationPort().assertAvailable()).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      statusCode: 503,
    });
  });

  it('does not invent unconfigured connectors', async () => {
    const port = new EmptyConnectorDiagnosticsPort();
    await expect(port.list()).resolves.toEqual([]);
    await expect(port.health()).resolves.toEqual([]);
  });
});
