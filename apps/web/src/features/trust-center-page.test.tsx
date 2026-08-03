// @vitest-environment jsdom

import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { renderApp } from '@/test/render';

import { useTrustSummary } from './data-hooks';
import { TrustCenterPage } from './trust-center-page';

vi.mock('./data-hooks', () => ({ useTrustSummary: vi.fn() }));

const runId = '00000000-0000-4000-8000-000000000111';

describe('TrustCenterPage', () => {
  it('shows inspectable evidence without inventing an aggregate trust score', () => {
    vi.mocked(useTrustSummary).mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        run: {
          id: runId,
          revision: 1,
          status: 'COMPLETED',
          quality: 'FIXTURE_ONLY',
          requestedExecutionMode: 'FIXTURE',
          executionMode: 'FIXTURE',
          configurationHash: 'a'.repeat(64),
        },
        fixtureManifest: {
          version: 'fixture-manifest.v1',
          sha256: 'b'.repeat(64),
          fixtureId: 'dengue',
          entrySha256: 'c'.repeat(64),
          reviewStatus: 'APPROVED',
          sourceKind: 'SYNTHETIC',
          scientificUse: false,
        },
        sourceCounts: [
          { status: 'LIVE', count: 0 },
          { status: 'CACHED', count: 0 },
          { status: 'SYNTHETIC', count: 0 },
          { status: 'FIXTURE', count: 3 },
          { status: 'FAILED', count: 0 },
        ],
        stages: [
          {
            stageKey: 'predict_mhci',
            attempt: 1,
            status: 'SUCCEEDED',
            inputHash: 'd'.repeat(64),
            outputHash: 'e'.repeat(64),
          },
        ],
        approvals: [
          {
            id: '00000000-0000-4000-8000-000000000121',
            type: 'CONFIGURATION',
            status: 'APPROVED',
            snapshotHash: 'a'.repeat(64),
            recordedAt: '2026-08-03T12:00:00.000Z',
          },
        ],
        artifacts: [],
        checks: [
          {
            id: 'fixture_manifest_valid',
            label: 'Fixture manifest integrity',
            status: 'PASS',
            detail: 'Frozen hashes verified.',
            evidence: ['Manifest and content hashes match.'],
          },
          {
            id: 'artifact_hashes',
            label: 'Artifact hash verification',
            status: 'UNAVAILABLE',
            detail: 'No report artifact has been generated yet.',
            evidence: ['Generate an approved report to create hash evidence.'],
          },
        ],
        disclaimer: 'Demonstration only — not scientific output.',
        evaluatedAt: '2026-08-03T12:30:00.000Z',
      },
      error: null,
      refetch: vi.fn(),
    } as never);

    renderApp(
      <Routes>
        <Route path="/runs/:runId/trust" element={<TrustCenterPage />} />
      </Routes>,
      [`/runs/${runId}/trust`],
    );

    expect(screen.getByRole('heading', { name: /scientific trust center/i })).toBeVisible();
    expect(screen.getByText('Fixture manifest integrity')).toBeVisible();
    expect(screen.getByText('Demonstration only — not scientific output.')).toBeVisible();
    expect(screen.getByText('UNAVAILABLE')).toBeVisible();
    expect(screen.getByRole('link', { name: /continue to reports/i })).toHaveAttribute(
      'href',
      `/runs/${runId}/reports`,
    );
    expect(screen.queryByText(/trust score/i)).not.toBeInTheDocument();
  });
});
