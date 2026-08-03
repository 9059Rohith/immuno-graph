import { trustSummarySchema } from '@immunograph/shared';
import { describe, expect, it, vi } from 'vitest';

import { TrustService } from './trust-service.js';

const runId = '00000000-0000-4000-8000-000000000111';
const createdAt = new Date('2026-08-03T12:00:00.000Z');

describe('TrustService', () => {
  it('aggregates hashes, provenance, rules, and approval evidence without a trust score', async () => {
    const repositories = {
      runs: {
        findDetailById: vi.fn().mockResolvedValue({
          id: runId,
          projectId: '00000000-0000-4000-8000-000000000112',
          revision: 1,
          status: 'COMPLETED',
          quality: 'FIXTURE_ONLY',
          requestedExecutionMode: 'FIXTURE',
          executionMode: 'FIXTURE',
          configurationHash: 'a'.repeat(64),
          approvals: [
            {
              id: '00000000-0000-4000-8000-000000000121',
              type: 'CONFIGURATION',
              status: 'APPROVED',
              snapshotHash: 'a'.repeat(64),
              createdAt,
            },
            {
              id: '00000000-0000-4000-8000-000000000122',
              type: 'SHORTLIST',
              status: 'APPROVED',
              snapshotHash: 'b'.repeat(64),
              createdAt,
            },
          ],
          predictorExecutions: [
            {
              connectorId: 'fixture-registry',
              connectorVersion: '1.0.0',
              method: 'curated-replay',
              methodVersion: 'fixture-v1',
              sourceStatus: 'FIXTURE',
              inputHash: 'c'.repeat(64),
              outputHash: 'd'.repeat(64),
            },
          ],
          stages: [
            {
              stageKey: 'prediction',
              attempt: 1,
              status: 'SUCCEEDED',
              inputHash: 'c'.repeat(64),
              outputHash: 'd'.repeat(64),
            },
          ],
        }),
      },
      constraintOutcomes: {
        listByRun: vi.fn().mockResolvedValue([{ outcome: 'FAIL' }, { outcome: 'PASS' }]),
      },
      artifacts: {
        listByRun: vi.fn().mockResolvedValue([
          {
            id: '00000000-0000-4000-8000-000000000131',
            type: 'REPORT',
            format: 'JSON',
            sha256: 'e'.repeat(64),
            byteSize: 1024,
            createdAt,
          },
        ]),
      },
    };
    const manifestProvider = vi.fn().mockResolvedValue({
      version: 'fixture-manifest.v1',
      sha256: 'f'.repeat(64),
      entries: [
        {
          fixtureId: 'dengue',
          organism: 'Synthetic demonstration',
          proteinName: 'Synthetic envelope-style demo protein',
          reviewStatus: 'APPROVED',
          sourceKind: 'SYNTHETIC',
          scientificUse: false,
          sha256: '1'.repeat(64),
        },
      ],
    });
    const service = new TrustService(
      repositories as never,
      manifestProvider,
      () => new Date('2026-08-03T12:30:00.000Z'),
    );

    const summary = trustSummarySchema.parse(await service.get(runId));

    expect(summary.checks.every(({ status }) => status === 'PASS')).toBe(true);
    expect(summary.sourceCounts).toContainEqual({ status: 'FIXTURE', count: 1 });
    expect(summary.artifacts[0]?.sha256).toBe('e'.repeat(64));
    expect(summary.disclaimer).toBe('Demonstration only — not scientific output.');
    expect(summary).not.toHaveProperty('trustScore');
  });

  it('rejects an unknown run', async () => {
    const service = new TrustService(
      {
        runs: { findDetailById: vi.fn().mockResolvedValue(null) },
        constraintOutcomes: { listByRun: vi.fn() },
        artifacts: { listByRun: vi.fn() },
      } as never,
      vi.fn(),
    );

    await expect(service.get(runId)).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
  });
});
