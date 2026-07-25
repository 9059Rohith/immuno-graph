import { describe, expect, it } from 'vitest';

import {
  predictorExecutionCreateSchema,
  profileMetadataSchema,
  projectCreateSchema,
  proteinInputCreateSchema,
  rankingProfileSchema,
  runConfigurationSnapshotSchema,
  workflowRunCreateSchema,
} from './validation.js';

const SHA256 = 'a'.repeat(64);

describe('database input validation', () => {
  it('accepts immutable profile metadata and rejects embedded definitions', () => {
    expect(
      profileMetadataSchema.parse({ name: 'ranking', version: 'mvp-v1.0', hash: SHA256 }),
    ).toEqual({ name: 'ranking', version: 'mvp-v1.0', hash: SHA256 });

    expect(() =>
      profileMetadataSchema.parse({
        name: 'ranking',
        version: 'mvp-v1.0',
        hash: SHA256,
        weights: { binding: 1 },
      }),
    ).toThrow();

    expect(() =>
      runConfigurationSnapshotSchema.parse({
        profiles: {
          biologicalConstraints: {
            name: 'biological-constraints',
            version: 'mvp-v1.0',
            hash: SHA256,
          },
          ranking: {
            name: 'ranking',
            version: 'mvp-v1.0',
            hash: SHA256,
            definition: { weights: {} },
          },
        },
      }),
    ).toThrow();

    expect(() =>
      runConfigurationSnapshotSchema.parse({
        profiles: {
          biologicalConstraints: {
            name: 'biological-constraints',
            version: 'mvp-v1.0',
            hash: SHA256,
          },
          ranking: { name: 'ranking', version: 'mvp-v1.0', hash: SHA256 },
          embeddedRuleDefinition: { rules: [{ id: 'invented' }] },
        },
      }),
    ).toThrow();
  });

  it('freezes the approved MVP ranking weights', () => {
    expect(
      rankingProfileSchema.parse({
        name: 'ranking',
        version: 'mvp-v1.0',
        tCell: {
          binding: 0.4,
          consensus: 0.3,
          populationCoverage: 0.2,
          completeness: 0.1,
        },
        bCell: { graphBepi: 0.9, completeness: 0.1 },
      }),
    ).toBeDefined();

    expect(() =>
      rankingProfileSchema.parse({
        name: 'ranking',
        version: 'mvp-v1.0',
        tCell: {
          binding: 0.25,
          consensus: 0.25,
          populationCoverage: 0.25,
          completeness: 0.25,
        },
        bCell: { graphBepi: 0.9, completeness: 0.1 },
      }),
    ).toThrow();
  });

  it('validates project and protein boundaries', () => {
    expect(() => projectCreateSchema.parse({ name: '' })).toThrow();
    expect(() => projectCreateSchema.parse({ name: 'x'.repeat(121) })).toThrow();
    expect(() =>
      proteinInputCreateSchema.parse({
        projectId: 'project',
        originalFasta: '>p\nACDZ',
        header: 'p',
        normalizedSequence: 'ACDZ',
        sequenceLength: 4,
        sha256: SHA256,
        validationProfileVersion: 'mvp-v1.0',
      }),
    ).toThrow();
  });

  it('requires profile metadata in the immutable run snapshot', () => {
    expect(() =>
      workflowRunCreateSchema.parse({
        projectId: 'project',
        proteinInputId: 'protein',
        revision: 1,
        status: 'DRAFT',
        configurationJson: JSON.stringify({ profiles: {} }),
        configurationHash: SHA256,
        ruleProfileVersion: 'mvp-v1.0',
        rankingProfileVersion: 'mvp-v1.0',
      }),
    ).toThrow();
  });

  it('enforces connector source invariants', () => {
    const base = {
      runId: 'run',
      stageId: 'stage',
      connectorId: 'iedb',
      connectorVersion: '1',
      method: 'binding',
      methodVersion: '1',
      status: 'COMPLETED',
      sourceStatus: 'CACHED',
      parametersJson: '{}',
      inputHash: SHA256,
      attemptCount: 1,
      startedAt: new Date(),
    };

    expect(() => predictorExecutionCreateSchema.parse(base)).toThrow();
    expect(() =>
      predictorExecutionCreateSchema.parse({
        ...base,
        connectorId: 'graphbepi',
        sourceStatus: 'LIVE',
      }),
    ).toThrow();
  });
});
