import { describe, expect, it } from 'vitest';

import {
  configurationHash,
  normalizeRunConfiguration,
  parseStoredRunConfiguration,
  serializeRunConfiguration,
} from './json.js';

const input = {
  analysis: {
    mhci: {
      enabled: true,
      alleles: ['B', 'A', 'A'],
      peptideLengths: [10, 9, 9],
      methods: ['zeta', 'alpha'],
    },
    mhcii: { enabled: false, alleles: [], peptideLengths: [], methods: [] },
    bcell: { enabled: false, methods: [] },
  },
  populations: ['USA', 'INDIA', 'USA'],
  fallbackPolicy: 'CACHE_THEN_LIVE',
  ruleProfileVersion: 'mvp-v1.0',
  rankingProfileVersion: 'mvp-v1.0',
  outputPreferences: {
    formats: ['CSV', 'JSON'] as ('CSV' | 'JSON')[],
    templateVersion: 'research-report-v1',
    includeWorkflowTrace: true,
    includeEvidenceGraph: true,
  },
};

describe('stored run configuration', () => {
  it('defaults legacy requests to automatic execution intent', () => {
    expect(normalizeRunConfiguration(input).requestedExecutionMode).toBe('AUTO');
  });

  it('preserves an explicit synthetic execution intent', () => {
    expect(
      normalizeRunConfiguration({ ...input, requestedExecutionMode: 'SYNTHETIC' })
        .requestedExecutionMode,
    ).toBe('SYNTHETIC');
  });

  it('normalizes unordered arrays deterministically', () => {
    expect(normalizeRunConfiguration(input)).toMatchObject({
      populations: ['INDIA', 'USA'],
      analysis: {
        mhci: {
          alleles: ['A', 'B'],
          peptideLengths: [9, 10],
          methods: ['alpha', 'zeta'],
        },
      },
    });
  });

  it('serializes, hashes, and parses only profile metadata', () => {
    const snapshot = {
      request: normalizeRunConfiguration(input),
      profiles: {
        biologicalConstraints: {
          name: 'biological-constraints',
          version: 'mvp-v1.0',
          hash: 'a'.repeat(64),
        },
        ranking: { name: 'ranking', version: 'mvp-v1.0', hash: 'b'.repeat(64) },
      },
    };
    const serialized = serializeRunConfiguration(snapshot);

    expect(parseStoredRunConfiguration(serialized)).toEqual(snapshot);
    expect(configurationHash(snapshot)).toMatch(/^[a-f0-9]{64}$/);
    expect(serialized).not.toContain('definition');
  });
});
