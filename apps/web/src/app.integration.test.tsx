// @vitest-environment jsdom

import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from './app';
import { renderApp } from './test/render';

afterEach(() => vi.unstubAllGlobals());

describe('application shell', () => {
  it('uses the approved global navigation without a Current Run item', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 503 })),
    );
    renderApp(<App />);

    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Projects' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Diagnostics' })).toBeVisible();
    expect(screen.queryByText('Current Run')).not.toBeInTheDocument();
    expect(await screen.findByText('Research Projects')).toBeVisible();
    expect(await screen.findByText('API unavailable')).toBeVisible();
  });

  it('shows project navigation context without adding a global current-run item', async () => {
    const projectId = '00000000-0000-4000-8000-000000000010';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/settings/runtime')) return new Response('', { status: 503 });
        return new Response(
          JSON.stringify({
            requestId: '00000000-0000-4000-8000-000000000001',
            data: {
              project: {
                id: projectId,
                name: 'Dengue envelope',
                organism: 'Dengue virus',
                proteinName: 'Envelope protein',
                description: null,
                createdAt: '2026-07-24T00:00:00.000Z',
                updatedAt: '2026-07-24T00:00:00.000Z',
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
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }),
    );
    renderApp(<App />, [`/projects/${projectId}`]);

    expect(await screen.findByText('Project workspace')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute(
      'href',
      `/projects/${projectId}`,
    );
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'href',
      `/projects/${projectId}/settings`,
    );
  });
});
