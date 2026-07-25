import { describe, expect, it, vi } from 'vitest';

import { HybridBindingCapabilityPort } from './hybrid-binding-capability-port.js';

// ---------------------------------------------------------------------------
// The proteinRef must equal sha256('ACDEFGHIKLMNPQRST') to satisfy the IEDB
// live connector's sequence-hash integrity check.
// ---------------------------------------------------------------------------
const SEQUENCE = 'ACDEFGHIKLMNPQRST';
const PROTEIN_HASH = '9901847d82f3d83ace03b57ac8ec624b2566eb06800281aa4913f4123e9d279a';

const VALID_TSV = [
  'allele\tseq_num\tstart\tend\tlength\tpeptide\tcore\ticore\tscore\tpercentile_rank',
  'HLA-A*02:01\t1\t1\t9\t9\tACDEFGHIK\tACDEFGHIK\tACDEFGHIK\t0.75\t0.4',
].join('\n');

function makeLiveFetch() {
  return vi.fn<typeof fetch>().mockResolvedValue(
    new Response(VALID_TSV, {
      status: 200,
      headers: { 'content-type': 'text/tab-separated-values' },
    }),
  );
}

const baseInput = {
  runId: 'run-1',
  proteinRef: PROTEIN_HASH,
  sequence: SEQUENCE,
  alleles: ['HLA-A*02:01'],
  peptideLengths: [9],
  methods: ['iedb-recommended'],
  fallbackPolicy: 'LIVE_ONLY',
};

function makeLivePort(fetchMock = makeLiveFetch()) {
  return new HybridBindingCapabilityPort({
    iedb: { enabled: true, request: fetchMock },
  });
}

function makeOfflinePort() {
  return new HybridBindingCapabilityPort({ iedb: { enabled: false } });
}

describe('HybridBindingCapabilityPort', () => {
  it('routes predict_mhci to IEDB when live is enabled and policy is LIVE_ONLY', async () => {
    const fetchMock = makeLiveFetch();
    const port = new HybridBindingCapabilityPort({
      iedb: { enabled: true, request: fetchMock },
    });
    const result = (await port.invoke('predict_mhci', baseInput)) as {
      provenance: Array<Record<string, unknown>>;
    };
    expect(result.provenance[0]?.status).toBe('LIVE');
    expect(fetchMock).toHaveBeenCalled();
  });

  it('routes MHC-I to local MHCflurry when IEDB is disabled and MHCflurry is enabled', async () => {
    const mhcflurryRunner = vi.fn().mockResolvedValue({
      stdout: [
        'sequence_name,pos,peptide,best_allele,mhcflurry_presentation_score,mhcflurry_affinity,mhcflurry_affinity_percentile',
        'sequence_0,0,ACDEFGHIK,HLA-A*02:01,0.82,34.5,0.4',
      ].join('\n'),
      stderr: '',
    });
    const port = new HybridBindingCapabilityPort({
      iedb: { enabled: false },
      mhcflurry: { enabled: true, runner: mhcflurryRunner },
    });

    const result = (await port.invoke('predict_mhci', {
      ...baseInput,
      methods: ['mhcflurry-presentation'],
      fallbackPolicy: 'LIVE_ONLY',
    })) as { provenance: Array<Record<string, unknown>> };

    expect(result.provenance[0]).toMatchObject({
      connectorId: 'mhcflurry',
      status: 'LIVE',
      predictionSource: 'LIVE',
    });
    expect(mhcflurryRunner).toHaveBeenCalledOnce();
  });

  it('combines IEDB and MHCflurry MHC-I observations when both live methods are selected', async () => {
    const fetchMock = makeLiveFetch();
    const mhcflurryRunner = vi.fn().mockResolvedValue({
      stdout: [
        'sequence_name,pos,peptide,best_allele,mhcflurry_presentation_score,mhcflurry_affinity,mhcflurry_affinity_percentile',
        'sequence_0,0,ACDEFGHIK,HLA-A*02:01,0.82,34.5,0.4',
      ].join('\n'),
      stderr: '',
    });
    const port = new HybridBindingCapabilityPort({
      iedb: { enabled: true, request: fetchMock },
      mhcflurry: { enabled: true, runner: mhcflurryRunner },
    });

    const result = (await port.invoke('predict_mhci', {
      ...baseInput,
      methods: ['iedb-recommended', 'mhcflurry-presentation'],
      fallbackPolicy: 'LIVE_ONLY',
    })) as {
      observations: Array<Record<string, unknown>>;
      provenance: Array<Record<string, unknown>>;
    };

    expect(result.observations).toHaveLength(2);
    expect(result.provenance.map((entry) => entry.connectorId)).toEqual(['iedb', 'mhcflurry']);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(mhcflurryRunner).toHaveBeenCalledOnce();
  });

  it('does not route MHC-II to MHCflurry', async () => {
    const mhcflurryRunner = vi.fn();
    const port = new HybridBindingCapabilityPort({
      iedb: { enabled: false },
      mhcflurry: { enabled: true, runner: mhcflurryRunner },
    });

    await expect(
      port.invoke('predict_mhcii', { ...baseInput, fallbackPolicy: 'LIVE_ONLY' }),
    ).rejects.toMatchObject({ code: 'LIVE_CONNECTOR_REQUIRED' });
    expect(mhcflurryRunner).not.toHaveBeenCalled();
  });

  it('falls back to fixture on HTTP 500 (transient CONNECTOR error) when policy permits', async () => {
    const failingFetch = vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 500 }));
    const port = new HybridBindingCapabilityPort({
      iedb: { enabled: true, request: failingFetch },
    });
    // HTTP 500 is a transient connector error. With CACHE_THEN_LIVE_THEN_FIXTURE policy,
    // hybrid falls through to fixture. Fixture throws FIXTURE_NOT_FOUND for our test hash.
    await expect(
      port.invoke('predict_mhci', {
        ...baseInput,
        fallbackPolicy: 'CACHE_THEN_LIVE_THEN_FIXTURE',
      }),
    ).rejects.toMatchObject({
      code: expect.stringMatching(/FIXTURE_NOT_FOUND|DEPENDENCY_UNAVAILABLE/),
    });
  });

  it('does NOT fall back to fixture on rate-limit with LIVE_ONLY policy', async () => {
    const rateLimitedFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('', { status: 429 }));
    const port = new HybridBindingCapabilityPort({
      iedb: { enabled: true, request: rateLimitedFetch },
    });
    // LIVE_ONLY: transient error but fixture not permitted, so error propagates.
    await expect(
      port.invoke('predict_mhci', { ...baseInput, fallbackPolicy: 'LIVE_ONLY' }),
    ).rejects.toMatchObject({ code: 'IEDB_RATE_LIMITED' });
  });

  it('skips live entirely and goes to fixture when policy is FIXTURE_ONLY', async () => {
    const shouldNotBeCalled = vi.fn<typeof fetch>();
    const port = new HybridBindingCapabilityPort({
      iedb: { enabled: true, request: shouldNotBeCalled },
    });
    await expect(
      port.invoke('predict_mhci', { ...baseInput, fallbackPolicy: 'FIXTURE_ONLY' }),
    ).rejects.toMatchObject({
      code: expect.stringMatching(/FIXTURE_NOT_FOUND|DEPENDENCY_UNAVAILABLE/),
    });
    expect(shouldNotBeCalled).not.toHaveBeenCalled();
  });

  it('uses fixture when IEDB is disabled and policy permits (offline/backup mode)', async () => {
    const port = makeOfflinePort();
    // Fixture port throws FIXTURE_NOT_FOUND for our test hash - confirms fixture was invoked.
    await expect(
      port.invoke('predict_mhci', { ...baseInput, fallbackPolicy: 'CACHE_THEN_LIVE_THEN_FIXTURE' }),
    ).rejects.toMatchObject({
      code: expect.stringMatching(/FIXTURE_NOT_FOUND|DEPENDENCY_UNAVAILABLE/),
    });
  });

  it('throws LIVE_CONNECTOR_REQUIRED when live is disabled and policy is LIVE_ONLY', async () => {
    const port = makeOfflinePort();
    await expect(
      port.invoke('predict_mhci', { ...baseInput, fallbackPolicy: 'LIVE_ONLY' }),
    ).rejects.toMatchObject({ code: 'LIVE_CONNECTOR_REQUIRED' });
  });

  it('routes non-binding capabilities to fixture port without calling IEDB', async () => {
    const shouldNotBeCalled = vi.fn<typeof fetch>();
    const port = new HybridBindingCapabilityPort({
      iedb: { enabled: true, request: shouldNotBeCalled },
    });
    // predict_bcell_fixture is handled by LocalFixtureCapabilityPort.
    await expect(port.invoke('predict_bcell_fixture', {})).rejects.toMatchObject({
      code: expect.stringMatching(/FIXTURE_NOT_FOUND|DEPENDENCY_UNAVAILABLE/),
    });
    expect(shouldNotBeCalled).not.toHaveBeenCalled();
  });

  it('exposes liveEnabled=true when IEDB live is configured', () => {
    const port = makeLivePort();
    expect(port.liveEnabled).toBe(true);
  });

  it('exposes liveEnabled=false when IEDB live is disabled', () => {
    const port = makeOfflinePort();
    expect(port.liveEnabled).toBe(false);
  });
});
