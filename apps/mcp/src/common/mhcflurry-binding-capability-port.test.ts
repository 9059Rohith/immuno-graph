import { describe, expect, it, vi } from 'vitest';

import { MhcflurryBindingCapabilityPort } from './mhcflurry-binding-capability-port.js';

const SEQUENCE = 'ACDEFGHIKLMNPQRST';
const PROTEIN_HASH = '9901847d82f3d83ace03b57ac8ec624b2566eb06800281aa4913f4123e9d279a';

const input = {
  runId: 'run-1',
  proteinRef: PROTEIN_HASH,
  sequence: SEQUENCE,
  alleles: ['HLA-A*02:01'],
  peptideLengths: [9],
  methods: ['mhcflurry-presentation'],
  fallbackPolicy: 'LIVE_ONLY',
};

const csv = [
  'sequence_name,pos,peptide,sample_name,best_allele,mhcflurry_presentation_score,mhcflurry_affinity,mhcflurry_affinity_percentile,mhcflurry_processing_score',
  'sequence_0,0,ACDEFGHIK,HLA-A*02:01,HLA-A*02:01,0.82,34.5,0.4,0.77',
].join('\n');

describe('MhcflurryBindingCapabilityPort', () => {
  it('maps MHCflurry predict-scan CSV to canonical LIVE MHC-I observations', async () => {
    const runner = vi.fn().mockResolvedValue({ stdout: csv, stderr: '' });
    const port = new MhcflurryBindingCapabilityPort({ enabled: true, runner });

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
        method: 'mhcflurry-presentation',
        methodVersion: '2.3.0',
        rawScore: 0.82,
      }),
    ]);
    expect(result.observations[0]?.rawFields).toMatchObject({
      affinityNm: 34.5,
      affinityPercentile: 0.4,
      processingScore: 0.77,
      bestAllele: 'HLA-A*02:01',
    });
    expect(result.provenance).toEqual([
      expect.objectContaining({
        connectorId: 'mhcflurry',
        connectorVersion: 'local-cli-v1',
        method: 'mhcflurry-presentation',
        methodVersion: '2.3.0',
        status: 'LIVE',
        predictionSource: 'LIVE',
        scientificUse: true,
        validationStatus: 'SCIENTIFIC',
      }),
    ]);
    expect(runner).toHaveBeenCalledWith(
      expect.arrayContaining([
        'predict-scan',
        '--sequences',
        SEQUENCE,
        '--alleles',
        'HLA-A*02:01',
        '--peptide-lengths',
        '9',
        '--results-all',
      ]),
      expect.objectContaining({ timeoutMs: 120_000 }),
    );
  });

  it('does not run MHCflurry when the connector is disabled', async () => {
    const runner = vi.fn();
    const port = new MhcflurryBindingCapabilityPort({ enabled: false, runner });

    await expect(port.invoke('predict_mhci', input)).rejects.toMatchObject({
      code: 'MHCFLURRY_NOT_CONFIGURED',
      category: 'CONNECTOR',
      retryable: true,
    });
    expect(runner).not.toHaveBeenCalled();
  });

  it('supports direct mhcflurry-predict-scan executables without adding a parent subcommand', async () => {
    const runner = vi.fn().mockResolvedValue({ stdout: csv, stderr: '' });
    const port = new MhcflurryBindingCapabilityPort({
      enabled: true,
      command: 'mhcflurry-predict-scan.exe',
      runner,
    });

    await port.invoke('predict_mhci', input);

    expect(runner).toHaveBeenCalledWith(
      expect.not.arrayContaining(['predict-scan']),
      expect.objectContaining({ timeoutMs: 120_000 }),
    );
    expect(runner).toHaveBeenCalledWith(
      expect.arrayContaining(['--sequences', SEQUENCE]),
      expect.objectContaining({ timeoutMs: 120_000 }),
    );
  });

  it('ignores MHCflurry progress preamble before the CSV header', async () => {
    const runner = vi.fn().mockResolvedValue({
      stdout: ['Predicting processing.', 'Predicting affinities.', csv].join('\n'),
      stderr: '',
    });
    const port = new MhcflurryBindingCapabilityPort({ enabled: true, runner });

    const result = (await port.invoke('predict_mhci', input)) as {
      observations: Array<Record<string, unknown>>;
    };

    expect(result.observations).toHaveLength(1);
  });

  it('rejects non-MHC-I prediction capabilities', async () => {
    const port = new MhcflurryBindingCapabilityPort({
      enabled: true,
      runner: vi.fn().mockResolvedValue({ stdout: csv, stderr: '' }),
    });

    await expect(port.invoke('predict_mhcii', input)).rejects.toMatchObject({
      code: 'MHCFLURRY_CAPABILITY_UNSUPPORTED',
    });
  });
});
