import { describe, expect, it, vi } from 'vitest';

import { IedbBindingCapabilityPort } from './iedb-binding-capability-port.js';

// proteinRef must equal sha256('ACDEFGHIKLMNPQRST') to satisfy the IEDB port's
// sequence-hash integrity check before it makes any HTTP call.
const SEQUENCE = 'ACDEFGHIKLMNPQRST';
const PROTEIN_HASH = '9901847d82f3d83ace03b57ac8ec624b2566eb06800281aa4913f4123e9d279a';

const input = {
  runId: 'run-1',
  proteinRef: PROTEIN_HASH,
  sequence: SEQUENCE,
  alleles: ['HLA-A*02:01'],
  peptideLengths: [9],
  methods: ['iedb-recommended'],
  fallbackPolicy: 'LIVE_ONLY',
};

describe('IedbBindingCapabilityPort', () => {
  it('maps a validated IEDB TSV response to canonical LIVE observations', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          [
            'allele\tseq_num\tstart\tend\tlength\tpeptide\tcore\ticore\tscore\tpercentile_rank',
            'HLA-A*02:01\t1\t1\t9\t9\tACDEFGHIK\tACDEFGHIK\tACDEFGHIK\t0.75\t0.4',
          ].join('\n'),
          { status: 200, headers: { 'content-type': 'text/tab-separated-values' } },
        ),
      );
    const port = new IedbBindingCapabilityPort({ enabled: true, request });

    const result = (await port.invoke('predict_mhci', input)) as {
      observations: Array<Record<string, unknown>>;
      provenance: Array<Record<string, unknown>>;
    };

    expect(result.observations).toEqual([
      expect.objectContaining({
        candidateType: 'MHCI',
        peptide: 'ACDEFGHIK',
        start: 1,
        end: 9,
        length: 9,
        allele: 'HLA-A*02:01',
        method: 'iedb-recommended',
        rawScore: 0.75,
        percentileRank: 0.4,
      }),
    ]);
    expect(result.provenance).toEqual([
      expect.objectContaining({
        connectorId: 'iedb',
        status: 'LIVE',
        predictionSource: 'LIVE',
        scientificUse: true,
        validationStatus: 'SCIENTIFIC',
      }),
    ]);
    expect(request).toHaveBeenCalledOnce();
    expect(request).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          accept: expect.stringContaining('text/tsv'),
        }),
      }),
    );
  });

  it('rejects a provider payload that lacks required scientific columns', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('message\nprovider unavailable', { status: 200 }));
    const port = new IedbBindingCapabilityPort({ enabled: true, request });

    await expect(port.invoke('predict_mhci', input)).rejects.toMatchObject({
      code: 'IEDB_RESPONSE_INVALID',
      category: 'CONNECTOR',
    });
  });

  it('maps rate limiting to a retryable typed error without returning fixture data', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 429 }));
    const port = new IedbBindingCapabilityPort({ enabled: true, request });

    await expect(port.invoke('predict_mhci', input)).rejects.toMatchObject({
      code: 'IEDB_RATE_LIMITED',
      category: 'RATE_LIMIT',
      retryable: true,
    });
  });

  it('does not call IEDB when live connectors are disabled', async () => {
    const request = vi.fn<typeof fetch>();
    const port = new IedbBindingCapabilityPort({ enabled: false, request });

    await expect(port.invoke('predict_mhci', input)).rejects.toMatchObject({
      code: 'IEDB_NOT_CONFIGURED',
    });
    expect(request).not.toHaveBeenCalled();
  });
});
