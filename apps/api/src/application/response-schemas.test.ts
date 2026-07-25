import { describe, expect, it } from 'vitest';

import {
  connectorStatusResponseSchema,
  constraintSummaryResponseSchema,
  eventHistorySchema,
  explanationResponseSchema,
  projectDeleteResponseSchema,
  scoreDistributionResponseSchema,
  shortlistOptimizationResponseSchema,
} from './response-schemas.js';

const id = '00000000-0000-4000-8000-000000000001';
const hash = 'a'.repeat(64);
const generatedAt = '2026-07-24T00:00:00.000Z';

describe('internal documented response schemas', () => {
  it('accepts the closed non-shared response shapes', () => {
    expect(projectDeleteResponseSchema.parse({ projectId: id, deleted: true })).toBeTruthy();
    expect(
      eventHistorySchema.parse({
        items: [{ id: '1', event: 'run.status_changed', data: { status: 'QUEUED' } }],
        nextCursor: null,
      }),
    ).toBeTruthy();
    expect(
      explanationResponseSchema.parse({
        text: 'Deterministic text',
        generationModeUsed: 'DETERMINISTIC',
      }),
    ).toBeTruthy();
    expect(
      shortlistOptimizationResponseSchema.parse({
        rankingSnapshotHash: hash,
        track: 'MHCI',
        algorithmId: 'greedy-coverage',
        algorithmVersion: '1',
        steps: [],
        finalCoverage: 0.8,
      }),
    ).toBeTruthy();
    expect(
      constraintSummaryResponseSchema.parse({ version: '1', outcomes: [], generatedAt }),
    ).toBeTruthy();
    expect(
      scoreDistributionResponseSchema.parse({ version: '1', bins: [], generatedAt }),
    ).toBeTruthy();
    expect(
      connectorStatusResponseSchema.parse({ version: '1', connectors: [], generatedAt }),
    ).toBeTruthy();
  });

  it('rejects undocumented properties', () => {
    expect(() =>
      projectDeleteResponseSchema.parse({ projectId: id, deleted: true, path: 'x' }),
    ).toThrow();
  });
});
