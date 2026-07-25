import { describe, expect, it, vi } from 'vitest';

import { IedbPopulationCoverageCapabilityPort } from './iedb-population-coverage-capability-port.js';

const input = {
  runId: 'run-1',
  associations: [
    { candidateId: 'candidate-1', peptide: 'ACDEFGHIK', allele: 'HLA-A*02:01' },
    { candidateId: 'candidate-2', peptide: 'LMNPQRSTV', allele: 'HLA-B*07:02' },
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
      code: 'IEDB_POPULATION_COVERAGE_RUNTIME_REQUIRED',
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

  it('maps the official IEDB standalone CLI table output to LIVE population coverage', async () => {
    const runner = vi.fn().mockResolvedValue({
      stdout: [
        'class I',
        'population/area\tcoverage\taverage_hit\tpc90',
        'Japan\t71.2%\t1.34\t0.48',
        'World\t63.4%\t1.12\t0.36',
        'average\t67.3%\t1.23\t0.42',
        'standard_deviation\t3.9%\t0.11\t0.06',
        '',
        'population/area\tepitope_hits\tpercent_individuals\tcumulative_coverage',
        'Japan\t0\t28.8\t28.8',
      ].join('\n'),
      stderr: '',
    });
    const port = new IedbPopulationCoverageCapabilityPort({
      enabled: true,
      scriptPath: 'C:/iedb/population_coverage/calculate_population_coverage.py',
      runner,
    });

    const result = (await port.invoke('calculate_population_coverage', input)) as {
      projectedCoverage: number;
      metrics: Record<string, unknown>;
      provenance: Record<string, unknown>;
    };

    expect(result.projectedCoverage).toBe(0.673);
    expect(result.metrics).toMatchObject({
      averageHits: 1.23,
      pc90: 0.42,
      populations: [
        { populationId: 'Japan', projectedCoverage: 0.712, averageHits: 1.34, pc90: 0.48 },
        { populationId: 'World', projectedCoverage: 0.634, averageHits: 1.12, pc90: 0.36 },
      ],
    });
    expect(result.provenance).toMatchObject({
      connectorId: 'iedb-population-coverage',
      connectorVersion: 'local-standalone-cli-v1',
      method: 'iedb-population-coverage',
      status: 'LIVE',
      predictionSource: 'LIVE',
      scientificUse: true,
      validationStatus: 'SCIENTIFIC',
    });
    expect(runner).toHaveBeenCalledWith(
      expect.arrayContaining([
        'C:/iedb/population_coverage/calculate_population_coverage.py',
        '-p',
        'World',
        '-c',
        'I',
        '-f',
      ]),
      expect.objectContaining({ timeoutMs: 120_000 }),
    );
  });

  it('requires peptide text for the official IEDB standalone CLI input file', async () => {
    const runner = vi.fn();
    const port = new IedbPopulationCoverageCapabilityPort({
      enabled: true,
      scriptPath: 'C:/iedb/population_coverage/calculate_population_coverage.py',
      runner,
    });

    await expect(
      port.invoke('calculate_population_coverage', {
        ...input,
        associations: [{ candidateId: 'candidate-1', allele: 'HLA-A*02:01' }],
      }),
    ).rejects.toMatchObject({
      code: 'IEDB_POPULATION_COVERAGE_PEPTIDE_REQUIRED',
      category: 'VALIDATION',
    });
    expect(runner).not.toHaveBeenCalled();
  });
});
