// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SourceStatusBadge } from './source-status-badge';

describe('SourceStatusBadge', () => {
  it.each([
    ['LIVE', 'Live'],
    ['CACHED', 'Cached live result'],
    ['FIXTURE', 'Demo fixture'],
    ['FAILED', 'Failed'],
  ] as const)('renders %s with an accessible text label', (status, label) => {
    render(<SourceStatusBadge status={status} />);
    expect(screen.getByText(label)).toBeVisible();
  });
});
