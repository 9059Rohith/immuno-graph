import { describe, expect, it, vi } from 'vitest';

import { DemoService } from './demo-service.js';

const projectId = '00000000-0000-4000-8000-000000000101';
const runId = '00000000-0000-4000-8000-000000000102';
const now = new Date('2026-08-03T12:00:00.000Z');

describe('DemoService', () => {
  it('creates an isolated 24-hour dengue fixture workspace', async () => {
    const projects = {
      create: vi.fn().mockResolvedValue({ project: { id: projectId } }),
    };
    const runs = {
      create: vi.fn().mockResolvedValue({ id: runId }),
    };
    const service = new DemoService(projects as never, runs as never, () => now);

    await expect(service.start()).resolves.toEqual({
      projectId,
      runId,
      expiresAt: '2026-08-04T12:00:00.000Z',
      fixtureId: 'dengue',
      mode: 'PUBLIC_DEMO',
    });
    expect(projects.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'ImmunoGraph Judge Demo',
        organism: 'Synthetic demonstration',
        proteinName: 'Synthetic envelope-style demo protein',
        isDemo: true,
        demoExpiresAt: new Date('2026-08-04T12:00:00.000Z'),
        fasta: expect.stringContaining('SYNTHETIC_DEMO'),
      }),
    );
    expect(runs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId,
        requestedExecutionMode: 'FIXTURE',
        fallbackPolicy: 'FIXTURE_ONLY',
      }),
    );
  });
});
