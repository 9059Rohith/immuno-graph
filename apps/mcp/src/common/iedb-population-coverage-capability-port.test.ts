import { describe, expect, it, vi } from 'vitest';

import { IedbPopulationCoverageCapabilityPort } from './iedb-population-coverage-capability-port.js';

const input = {
  runId: 'run-1',
  associations: [
    { candidateId: 'candidate-1', allele: 'HLA-A*02:01' },
    { candidateId: 'candidate-2', allele: 'HLA-B*07:02' },
  ],
  populationIds: ['World'],
  classMode: 'CLASS_I',
  fallbackPolicy: 'LIVE_ONLY',
};

describe('IedbPopulationCoverageCapabilityPort', () => {
  it('maps a configured IEDB HTTP JSON response to LIVE population coverage', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          projectedCoverage: 0.734,
          averageHits: 1.42,
          pc90: 0.41,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const port = new IedbPopulationCoverageCapabilityPort({
      enabled: true,
      url: 'https://example.test/iedb/population',
      request,
    });

    const result = (await port.invoke('calculate_population_coverage', input)) as {
      projectedCoverage: number;
      metrics: Record<string, unknown>;
      provenance: Record<string, unknown>;
    };

    expect(result).toMatchObject({
      projectedCoverage: 0.734,
      metrics: { averageHits: 1.42, pc90: 0.41 },
      provenance: {
        connectorId: 'iedb-population-coverage',
        status: 'LIVE',
        predictionSource: 'LIVE',
        scientificUse: true,
        validationStatus: 'SCIENTIFIC',
      },
    });
    expect(request).toHaveBeenCalledWith(
      'https://example.test/iedb/population',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'content-type': 'application/json' }),
      }),
    );
  });

  it('requires an explicit endpoint before live population coverage can run', async () => {
    const request = vi.fn<typeof fetch>();
    const port = new IedbPopulationCoverageCapabilityPort({ enabled: true, request });

    await expect(port.invoke('calculate_population_coverage', input)).rejects.toMatchObject({
      code: 'IEDB_POPULATION_COVERAGE_URL_REQUIRED',
      category: 'CONNECTOR',
      retryable: true,
    });
    expect(request).not.toHaveBeenCalled();
  });

  it('maps rate limiting to a retryable typed error', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 429 }));
    const port = new IedbPopulationCoverageCapabilityPort({
      enabled: true,
      url: 'https://example.test/iedb/population',
      request,
    });

    await expect(port.invoke('calculate_population_coverage', input)).rejects.toMatchObject({
      code: 'IEDB_POPULATION_COVERAGE_RATE_LIMITED',
      category: 'RATE_LIMIT',
      retryable: true,
    });
  });
});
