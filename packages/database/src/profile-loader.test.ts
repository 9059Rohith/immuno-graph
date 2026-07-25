import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  computeProfileHash,
  DEFAULT_PROFILE_DIRECTORY,
  loadDefaultProfileSnapshot,
  loadProfileVersion,
} from './profile-loader.js';

describe('immutable file-backed profiles', () => {
  it('validates files and returns SHA-256 metadata only', async () => {
    const snapshot = await loadDefaultProfileSnapshot();
    const rankingFile = await readFile(join(DEFAULT_PROFILE_DIRECTORY, 'ranking.mvp-v1.0.json'));
    const rankingDefinition: unknown = JSON.parse(rankingFile.toString('utf8'));

    expect(snapshot.ranking).toEqual({
      name: 'ranking',
      version: 'mvp-v1.0',
      hash: computeProfileHash(rankingDefinition),
    });
    expect(snapshot.biologicalConstraints.name).toBe('biological-constraints');
    expect(Object.keys(snapshot.ranking).sort()).toEqual(['hash', 'name', 'version']);
  });

  it('loads only the explicitly requested immutable profile version', async () => {
    const loaded = await loadProfileVersion('ranking', 'mvp-v1.0');

    expect(loaded.metadata).toMatchObject({ name: 'ranking', version: 'mvp-v1.0' });
    await expect(loadProfileVersion('ranking', 'demo-v1')).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('rejects profile versions that could escape the profile directory', async () => {
    await expect(loadProfileVersion('ranking', '../ranking')).rejects.toThrow();
  });
});
