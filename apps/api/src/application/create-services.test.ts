import type { DatabaseClient } from '@immunograph/database';
import { describe, expect, it } from 'vitest';

import type { ApiEnvironment } from '../config/environment.js';
import { ConcreteRestApiServices } from './concrete-rest-api-services.js';
import { createServices } from './create-services.js';

const environment: ApiEnvironment = {
  API_HOST: '127.0.0.1',
  API_LOG_LEVEL: 'silent',
  API_PORT: 3000,
  NODE_ENV: 'test',
  DATABASE_URL: 'file:./unused.db',
  ARTIFACT_ROOT: './artifacts',
  DEMO_MODE: true,
  LLM_ENABLED: false,
  APPLICATION_VERSION: '0.1.0',
  SPECIFICATION_VERSION: '0.7.0-draft',
};

describe('createServices', () => {
  it('composes the concrete dispatcher with local fixture-capable defaults', async () => {
    const dispatcher = createServices({} as DatabaseClient, environment);

    expect(dispatcher).toBeInstanceOf(ConcreteRestApiServices);
    await expect(
      dispatcher.execute('connectors.list', {}, { requestId: 'request' }),
    ).resolves.toMatchObject({
      items: expect.arrayContaining([
        expect.objectContaining({ connectorId: 'iedb', fixtureOnly: false }),
        expect.objectContaining({ connectorId: 'iedb-population-coverage', fixtureOnly: false }),
        expect.objectContaining({ connectorId: 'graphbepi', fixtureOnly: true }),
      ]),
    });
  });
});
