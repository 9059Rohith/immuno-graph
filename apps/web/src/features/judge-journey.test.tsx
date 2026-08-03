import type { ProjectDetail, RunDetail } from '@immunograph/shared';
import { describe, expect, it } from 'vitest';

import { deriveJudgeSteps } from './judge-journey';

const projectId = '00000000-0000-4000-8000-000000000010';
const runId = '00000000-0000-4000-8000-000000000020';

const project = {
  project: {
    id: projectId,
    name: 'Dengue envelope demonstration',
    organism: 'Dengue virus 2',
    proteinName: 'Envelope glycoprotein',
    description: 'Curated hackathon fixture',
    createdAt: '2026-08-03T00:00:00.000Z',
    updatedAt: '2026-08-03T00:00:00.000Z',
  },
  protein: {
    id: '00000000-0000-4000-8000-000000000011',
    header: 'dengue-envelope',
    length: 100,
    sha256: 'a'.repeat(64),
    validationProfile: 'mvp-v1',
    warnings: [],
  },
  runs: [],
  latestApproval: null,
} as ProjectDetail;

function run(status: RunDetail['status']): RunDetail {
  return {
    id: runId,
    projectId,
    revision: 1,
    status,
    quality: status === 'COMPLETED' ? 'FIXTURE_ONLY' : null,
    executionMode: status === 'COMPLETED' ? 'FIXTURE' : null,
    configurationHash: 'b'.repeat(64),
    configuration: {
      analysis: {
        mhci: { enabled: true, alleles: ['HLA-A*02:01'], peptideLengths: [9], methods: ['demo'] },
        mhcii: { enabled: false, alleles: [], peptideLengths: [], methods: [] },
        bcell: { enabled: false, methods: [] },
      },
      populations: ['GLOBAL'],
      fallbackPolicy: 'FIXTURE_ONLY',
      requestedExecutionMode: 'FIXTURE',
      ruleProfileVersion: 'rules-v1',
      rankingProfileVersion: 'ranking-v1',
      outputPreferences: {
        formats: ['JSON'],
        templateVersion: 'report-v1',
        includeWorkflowTrace: true,
        includeEvidenceGraph: true,
      },
    },
    candidateCounts: {
      MHCI: { recommended: 1, review: 1, rejected: 1 },
      MHCII: { recommended: 0, review: 0, rejected: 0 },
      BCELL: { recommended: 0, review: 0, rejected: 0 },
    },
    stageProgress: [],
    connectors: [],
    approvalRequirements: ['CONFIGURATION', 'SHORTLIST'],
    createdAt: '2026-08-03T00:00:00.000Z',
    startedAt: status === 'COMPLETED' ? '2026-08-03T00:01:00.000Z' : null,
    completedAt: status === 'COMPLETED' ? '2026-08-03T00:02:00.000Z' : null,
    updatedAt: '2026-08-03T00:02:00.000Z',
  };
}

describe('deriveJudgeSteps', () => {
  it('starts a draft at configuration after validating the protein input', () => {
    expect(deriveJudgeSteps(project, run('DRAFT')).map(({ status }) => status)).toEqual([
      'complete',
      'current',
      'upcoming',
      'upcoming',
      'upcoming',
      'upcoming',
    ]);
  });

  it('moves the current milestone with server-recorded run state', () => {
    expect(deriveJudgeSteps(project, run('RUNNING')).find(({ status }) => status === 'current')?.id)
      .toBe('analysis');
    expect(
      deriveJudgeSteps(project, run('AWAITING_SHORTLIST_APPROVAL')).find(
        ({ status }) => status === 'current',
      )?.id,
    ).toBe('approval');
    expect(deriveJudgeSteps(project, run('COMPLETED')).at(-1)?.status).toBe('current');
  });

  it('uses real destinations for all six judge milestones', () => {
    expect(deriveJudgeSteps(project, run('COMPLETED')).map(({ id, to }) => [id, to])).toEqual([
      ['input', `/projects/${projectId}`],
      ['configuration', `/projects/${projectId}/settings`],
      ['analysis', `/runs/${runId}/workflow`],
      ['evidence', `/runs/${runId}/evidence`],
      ['approval', `/runs/${runId}/candidates`],
      ['report', `/runs/${runId}/reports`],
    ]);
  });
});
