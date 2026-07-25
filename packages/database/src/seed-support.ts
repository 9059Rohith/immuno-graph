import type { RunConfiguration } from '@immunograph/shared';

import type { ProfileMetadata } from './validation.js';

export const LEGACY_DEMO_PROJECT_ID = 'demo-project';
const DEMO_PROJECT_NAME = 'ImmunoGraph MVP Demo';

interface LegacySeedRepositories {
  projects: {
    findById(id: string): Promise<{ id: string; name: string } | null>;
    deleteTree(projectId: string): Promise<void>;
  };
}

interface DemoProfiles {
  biologicalConstraints: ProfileMetadata;
  ranking: ProfileMetadata;
}

export async function removeLegacyDemoSeed(repositories: LegacySeedRepositories): Promise<void> {
  const legacy = await repositories.projects.findById(LEGACY_DEMO_PROJECT_ID);
  if (legacy === null) return;
  if (legacy.name !== DEMO_PROJECT_NAME) {
    throw new Error(
      'Refusing to replace a project with the legacy demo identifier because its name is not the recognized demo name.',
    );
  }
  await repositories.projects.deleteTree(LEGACY_DEMO_PROJECT_ID);
}

export function createDemoRunSnapshot(profiles: DemoProfiles): {
  request: RunConfiguration;
  profiles: DemoProfiles;
} {
  return {
    request: {
      analysis: {
        mhci: {
          enabled: true,
          alleles: ['HLA-A*02:01'],
          peptideLengths: [9, 10],
          methods: ['iedb-recommended'],
        },
        mhcii: {
          enabled: true,
          alleles: ['HLA-DRB1*04:01'],
          peptideLengths: [15],
          methods: ['iedb-recommended'],
        },
        bcell: { enabled: true, methods: ['graphbepi'] },
      },
      populations: ['synthetic-population-alpha', 'synthetic-population-beta'],
      fallbackPolicy: 'CACHE_THEN_LIVE_THEN_FIXTURE',
      requestedExecutionMode: 'AUTO',
      ruleProfileVersion: profiles.biologicalConstraints.version,
      rankingProfileVersion: profiles.ranking.version,
      outputPreferences: {
        formats: ['JSON', 'CSV'],
        templateVersion: 'research-report-v1',
        includeWorkflowTrace: true,
        includeEvidenceGraph: true,
      },
    },
    profiles,
  };
}
