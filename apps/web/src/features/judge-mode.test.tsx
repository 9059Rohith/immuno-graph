// @vitest-environment jsdom

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiRequest } from '@/lib/api-client';
import { renderApp } from '@/test/render';

import { useJudgeMode } from './judge-mode';

vi.mock('@/lib/api-client', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/api-client')>();
  return { ...original, apiRequest: vi.fn() };
});

const workspace = {
  projectId: '00000000-0000-4000-8000-000000000101',
  runId: '00000000-0000-4000-8000-000000000102',
  expiresAt: '2026-08-04T12:00:00.000Z',
  fixtureId: 'dengue' as const,
  mode: 'PUBLIC_DEMO' as const,
};

function Harness() {
  const judge = useJudgeMode();
  const location = useLocation();
  return (
    <>
      <button onClick={() => void judge.startJudgeDemo()}>Start demo</button>
      <output>{location.pathname}</output>
      {judge.error !== null && <p role="alert">{judge.error}</p>}
    </>
  );
}

afterEach(() => {
  sessionStorage.clear();
  vi.clearAllMocks();
});

describe('JudgeModeProvider', () => {
  it('starts a public demo, stores only scoped identifiers, and opens the project', async () => {
    vi.mocked(apiRequest).mockResolvedValue(workspace);
    renderApp(<Harness />);

    await userEvent.click(screen.getByRole('button', { name: 'Start demo' }));

    expect(apiRequest).toHaveBeenCalledWith('/demo/start', expect.anything(), expect.anything());
    await waitFor(() => expect(screen.getByText(`/projects/${workspace.projectId}`)).toBeVisible());
    expect(JSON.parse(sessionStorage.getItem('immunograph.judge-workspace.v1') ?? '{}')).toEqual({
      projectId: workspace.projectId,
      runId: workspace.runId,
      expiresAt: workspace.expiresAt,
    });
  });
});
