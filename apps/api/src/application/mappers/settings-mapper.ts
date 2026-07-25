import type { ProfileMetadata } from '@immunograph/database';
import {
  profileListSchema,
  runtimeSettingsSchema,
  type RuntimeSettings,
} from '@immunograph/shared';

export function mapProfiles(profiles: readonly ProfileMetadata[]) {
  return profileListSchema.parse({
    items: profiles.map((profile) => ({
      name: profile.name,
      version: profile.version,
      sha256: profile.hash,
      approved: true,
    })),
  });
}

export function mapRuntimeSettings(value: RuntimeSettings): RuntimeSettings {
  return runtimeSettingsSchema.parse(value);
}
