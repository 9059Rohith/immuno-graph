import { describe, expect, it } from 'vitest';

import { profileListSchema, runtimeSettingsSchema } from '@immunograph/shared';

import { mapProfiles, mapRuntimeSettings } from './settings-mapper.js';

describe('settings mapper', () => {
  it('maps profile hashes and safe runtime values', () => {
    const profiles = mapProfiles([{ name: 'ranking', version: 'mvp-v1.0', hash: 'a'.repeat(64) }]);
    const runtime = mapRuntimeSettings({
      demoMode: true,
      llmEnabled: false,
      databaseStatus: 'AVAILABLE',
      artifactPathStatus: 'AVAILABLE',
      fixtureManifest: { version: 'mvp-v1.0', sha256: 'b'.repeat(64), entries: [] },
      build: {
        applicationVersion: '0.1.0',
        specificationVersion: '0.7.0-draft',
        commitSha: null,
        builtAt: null,
      },
    });
    expect(profileListSchema.parse(profiles)).toEqual(profiles);
    expect(runtimeSettingsSchema.parse(runtime)).toEqual(runtime);
  });
});
