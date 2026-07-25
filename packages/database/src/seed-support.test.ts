import { runConfigurationSchema } from '@immunograph/shared';
import { describe, expect, it, vi } from 'vitest';

import {
  LEGACY_DEMO_PROJECT_ID,
  createDemoRunSnapshot,
  removeLegacyDemoSeed,
} from './seed-support.js';

const profiles = {
  biologicalConstraints: {
    name: 'biological-constraints',
    version: 'mvp-v1.0',
    hash: 'a'.repeat(64),
  },
  ranking: { name: 'ranking', version: 'mvp-v1.0', hash: 'b'.repeat(64) },
};

describe('seed compatibility', () => {
  it('removes only the recognized legacy demo project tree', async () => {
    const deleteTree = vi.fn().mockResolvedValue(undefined);
    const repositories = {
      projects: {
        findById: vi.fn().mockResolvedValue({
          id: LEGACY_DEMO_PROJECT_ID,
          name: 'ImmunoGraph MVP Demo',
        }),
        deleteTree,
      },
    };

    await removeLegacyDemoSeed(repositories);

    expect(deleteTree).toHaveBeenCalledWith(LEGACY_DEMO_PROJECT_ID);
  });

  it('refuses to remove a non-demo project that happens to use the legacy ID', async () => {
    const repositories = {
      projects: {
        findById: vi.fn().mockResolvedValue({ id: LEGACY_DEMO_PROJECT_ID, name: 'Research data' }),
        deleteTree: vi.fn(),
      },
    };

    await expect(removeLegacyDemoSeed(repositories)).rejects.toThrow('legacy demo identifier');
    expect(repositories.projects.deleteTree).not.toHaveBeenCalled();
  });

  it('creates a complete run configuration snapshot with profile metadata only', () => {
    const snapshot = createDemoRunSnapshot(profiles);

    expect(runConfigurationSchema.parse(snapshot.request)).toEqual(snapshot.request);
    expect(snapshot.profiles).toEqual(profiles);
    expect(JSON.stringify(snapshot)).not.toContain('rules');
    expect(JSON.stringify(snapshot)).not.toContain('weights');
  });
});
