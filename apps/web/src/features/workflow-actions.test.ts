// @vitest-environment jsdom

import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { renderApp } from '@/test/render';

import { candidateListParams } from './candidate-query';

const { approveConfiguration, createRun } = vi.hoisted(() => ({
  approveConfiguration: vi.fn(),
  createRun: vi.fn(),
}));

vi.mock('./data-hooks', () => ({
  useApproveConfiguration: () => ({
    data: undefined,
    error: undefined,
    isError: false,
    isPending: false,
    mutate: approveConfiguration,
  }),
  useCreateRun: () => ({
    data: undefined,
    error: undefined,
    isError: false,
    isPending: false,
    mutate: createRun,
  }),
}));

import { createRunConfigurationInput, createShortlistApprovalInput } from './workflow-actions';
import { ProjectSettingsPage } from './workspace-pages';

describe('workflow action payloads', () => {
  it('normalizes researcher-entered configuration into the API contract', () => {
    expect(
      createRunConfigurationInput({
        mhciAlleles: 'HLA-A*02:01, HLA-A*24:02',
        mhciLengths: '9, 10',
        mhciiAlleles: 'HLA-DRB1*04:01',
        mhciiLengths: '15',
        populations: 'INDIA, GLOBAL',
        enableMhcflurry: true,
        enableBcell: true,
        fallbackPolicy: 'CACHE_THEN_LIVE_THEN_FIXTURE',
        ruleProfileVersion: 'mvp-v1.0',
        rankingProfileVersion: 'mvp-v1.0',
      }),
    ).toMatchObject({
      analysis: {
        mhci: {
          alleles: ['HLA-A*02:01', 'HLA-A*24:02'],
          peptideLengths: [9, 10],
          methods: ['iedb-recommended', 'mhcflurry-presentation'],
        },
        bcell: { enabled: true, methods: ['graphbepi'] },
      },
      populations: ['INDIA', 'GLOBAL'],
      ruleProfileVersion: 'mvp-v1.0',
      rankingProfileVersion: 'mvp-v1.0',
    });
  });

  it('submits the existing MVP profiles from the run form defaults', async () => {
    renderApp(createElement(ProjectSettingsPage), ['/projects/project-1/settings']);

    expect(screen.getByLabelText('Rule profile version')).toHaveValue('mvp-v1.0');
    expect(screen.getByLabelText('Ranking profile version')).toHaveValue('mvp-v1.0');
    expect(screen.getByLabelText(/Enable local MHCflurry/)).not.toBeChecked();

    await userEvent.click(screen.getByRole('button', { name: 'Create configuration draft' }));

    expect(createRun).toHaveBeenCalledWith(
      expect.objectContaining({
        analysis: expect.objectContaining({
          mhci: expect.objectContaining({
            methods: ['iedb-recommended'],
          }),
        }),
        ruleProfileVersion: 'mvp-v1.0',
        rankingProfileVersion: 'mvp-v1.0',
      }),
    );
  });

  it('derives explicit shortlist exclusions from the ranking snapshot', () => {
    expect(
      createShortlistApprovalInput('a'.repeat(64), ['a', 'b', 'c'], ['a', 'c'], ' Reviewed '),
    ).toMatchObject({
      approvedCandidateIds: ['a', 'c'],
      excludedCandidateIds: ['b'],
      note: 'Reviewed',
    });
  });

  it('keeps UI-only candidate review params out of the documented candidate list API query', () => {
    const params = candidateListParams(
      new URLSearchParams({
        view: 'sequence',
        candidate: '00000000-0000-0000-0000-000000000001',
        track: 'MHCII',
        sourceStatus: 'SYNTHETIC',
        category: 'RECOMMENDED',
        search: 'ACD',
      }),
      'MHCI',
    );

    expect(params.toString()).toBe(
      'track=MHCI&sort=rank&limit=50&category=RECOMMENDED&sourceStatus=SYNTHETIC&search=ACD',
    );
  });
});
