import {
  DEFAULT_FIXTURE_DIRECTORY,
  DEFAULT_PROFILE_DIRECTORY,
  fixtureManifestSummary,
  loadDefaultProfileSnapshot,
  loadFixtureRegistry,
} from '@immunograph/database';
import {
  connectorHealthListSchema,
  connectorListSchema,
  type RuntimeSettings,
} from '@immunograph/shared';

import { mapProfiles, mapRuntimeSettings } from '../mappers/settings-mapper.js';
import type { ConnectorDiagnosticsPort } from '../ports.js';

interface DatabaseHealthProbe {
  check(): Promise<boolean>;
}

interface ArtifactHealthProbe {
  health(): Promise<'AVAILABLE' | 'UNAVAILABLE'>;
}

export interface DiagnosticsSettings {
  demoMode: boolean;
  llmEnabled: boolean;
  build: RuntimeSettings['build'];
  profileDirectory?: string;
  fixtureDirectory?: string;
}

export class DiagnosticsService {
  constructor(
    private readonly databaseHealth: DatabaseHealthProbe,
    private readonly connectorPort: ConnectorDiagnosticsPort,
    private readonly artifactHealth: ArtifactHealthProbe,
    private readonly settings: DiagnosticsSettings,
  ) {}

  async connectors() {
    return connectorListSchema.parse({ items: await this.connectorPort.list() });
  }

  async connectorHealth() {
    return connectorHealthListSchema.parse({ items: await this.connectorPort.health() });
  }

  async profiles() {
    const snapshot = await loadDefaultProfileSnapshot(
      this.settings.profileDirectory ?? DEFAULT_PROFILE_DIRECTORY,
    );
    return mapProfiles([snapshot.biologicalConstraints, snapshot.ranking]);
  }

  async runtime() {
    const [databaseAvailable, artifactPathStatus, registry] = await Promise.all([
      this.databaseHealth.check(),
      this.artifactHealth.health(),
      loadFixtureRegistry(this.settings.fixtureDirectory ?? DEFAULT_FIXTURE_DIRECTORY),
    ]);
    const manifest = fixtureManifestSummary(registry);
    return mapRuntimeSettings({
      demoMode: this.settings.demoMode,
      llmEnabled: this.settings.llmEnabled,
      databaseStatus: databaseAvailable ? 'AVAILABLE' : 'UNAVAILABLE',
      artifactPathStatus,
      fixtureManifest: {
        version: manifest.version,
        sha256: manifest.sha256,
        entries: manifest.entries.map((entry) => ({
          fixtureId: entry.fixtureId,
          organism: entry.organism,
          proteinName: entry.proteinName,
          approved: entry.reviewStatus === 'APPROVED',
          sha256: entry.sha256,
        })),
      },
      build: this.settings.build,
    });
  }
}
