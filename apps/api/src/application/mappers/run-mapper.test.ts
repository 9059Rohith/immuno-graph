import { describe, expect, it } from 'vitest';

import { runDetailSchema } from '@immunograph/shared';

import { mapRunDetail } from './run-mapper.js';

describe('run mapper', () => {
  it('separates lifecycle, quality, progress, and approval requirements', () => {
    const now = new Date('2026-07-24T00:00:10.000Z');
    const request = {
      analysis: {
        mhci: { enabled: true, alleles: ['A'], peptideLengths: [9], methods: ['iedb'] },
        mhcii: { enabled: false, alleles: [], peptideLengths: [], methods: [] },
        bcell: { enabled: false, methods: [] },
      },
      populations: ['INDIA'],
      fallbackPolicy: 'CACHE_THEN_LIVE',
      ruleProfileVersion: 'mvp-v1.0',
      rankingProfileVersion: 'mvp-v1.0',
      requestedExecutionMode: 'SYNTHETIC',
      outputPreferences: {
        formats: ['JSON'],
        templateVersion: 'v1',
        includeWorkflowTrace: false,
        includeEvidenceGraph: false,
      },
    };
    const record = {
      id: '00000000-0000-4000-8000-000000000003',
      projectId: '00000000-0000-4000-8000-000000000001',
      proteinInputId: '00000000-0000-4000-8000-000000000002',
      revision: 1,
      status: 'DRAFT',
      quality: null,
      configurationJson: JSON.stringify({
        request,
        profiles: {
          biologicalConstraints: {
            name: 'biological-constraints',
            version: 'mvp-v1.0',
            hash: 'a'.repeat(64),
          },
          ranking: { name: 'ranking', version: 'mvp-v1.0', hash: 'b'.repeat(64) },
        },
      }),
      configurationHash: 'c'.repeat(64),
      ruleProfileVersion: 'mvp-v1.0',
      rankingProfileVersion: 'mvp-v1.0',
      requestedExecutionMode: 'SYNTHETIC',
      executionMode: 'SYNTHETIC',
      replayHash: null,
      failureCode: null,
      createdAt: new Date('2026-07-24T00:00:00.000Z'),
      startedAt: null,
      completedAt: null,
      updatedAt: new Date('2026-07-24T00:00:00.000Z'),
      approvals: [],
      predictorExecutions: [],
      rankingResults: [],
      stages: [],
    };

    const mapped = mapRunDetail(record, now);
    expect(runDetailSchema.parse(mapped)).toEqual(mapped);
    expect(mapped.approvalRequirements).toEqual(['CONFIGURATION']);
    expect(mapped.quality).toBeNull();
    expect(mapped.executionMode).toBe('SYNTHETIC');
    expect(mapped.configuration.requestedExecutionMode).toBe('SYNTHETIC');
  });
});
