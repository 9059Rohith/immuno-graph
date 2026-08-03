// @vitest-environment jsdom

import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiRequest } from '@/lib/api-client';
import { renderApp } from '@/test/render';

import { LandingPage } from './landing-page';

vi.mock('@/lib/api-client', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/api-client')>();
  return { ...original, apiRequest: vi.fn() };
});

afterEach(() => {
  sessionStorage.clear();
  vi.clearAllMocks();
});

describe('LandingPage', () => {
  it('presents the hackathon value and launches without credentials', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      projectId: '00000000-0000-4000-8000-000000000101',
      runId: '00000000-0000-4000-8000-000000000102',
      expiresAt: '2026-08-04T12:00:00.000Z',
      fixtureId: 'dengue',
      mode: 'PUBLIC_DEMO',
    });
    renderApp(<LandingPage />);

    expect(
      screen.getByRole('heading', { name: /auditable epitope prioritization/i }),
    ).toBeVisible();
    expect(screen.getByText('Track 4 — Domain Agents')).toBeVisible();
    expect(screen.getByText(/synthetic demonstration only/i)).toBeVisible();
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /launch judge demo/i }));
    expect(apiRequest).toHaveBeenCalledTimes(1);
  });
});
