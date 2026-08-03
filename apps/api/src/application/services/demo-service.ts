import { loadFixtureRegistry } from '@immunograph/database';
import { demoWorkspaceSchema, type DemoWorkspace } from '@immunograph/shared';

import type { ProjectService } from './project-service.js';
import type { RunService } from './run-service.js';

type DemoProjectPort = Pick<ProjectService, 'create'>;
type DemoRunPort = Pick<RunService, 'create'>;

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1_000;

export class DemoService {
  constructor(
    private readonly projects: DemoProjectPort,
    private readonly runs: DemoRunPort,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async start(): Promise<DemoWorkspace> {
    const fixture = (await loadFixtureRegistry()).cases.find(
      ({ fixtureId }) => fixtureId === 'dengue',
    );
    if (fixture === undefined)
      throw new Error('The curated dengue demonstration fixture is unavailable.');

    const now = this.clock();
    const expiresAt = new Date(now.getTime() + DAY_IN_MILLISECONDS);
    const createdProject = await this.projects.create({
      name: 'ImmunoGraph Judge Demo',
      organism: fixture.metadata.organismLabel,
      proteinName: fixture.metadata.proteinName,
      description: fixture.metadata.description,
      fasta: `>${fixture.fasta.header}\n${fixture.fasta.sequence}\n`,
      isDemo: true,
      demoExpiresAt: expiresAt,
    });
    const run = await this.runs.create({
      projectId: createdProject.project.id,
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
      fallbackPolicy: 'FIXTURE_ONLY',
      requestedExecutionMode: 'FIXTURE',
      ruleProfileVersion: 'mvp-v1.0',
      rankingProfileVersion: 'mvp-v1.0',
      outputPreferences: {
        formats: ['JSON', 'CSV'],
        templateVersion: 'research-report-v1',
        includeWorkflowTrace: true,
        includeEvidenceGraph: true,
      },
    });

    return demoWorkspaceSchema.parse({
      projectId: createdProject.project.id,
      runId: run.id,
      expiresAt: expiresAt.toISOString(),
      fixtureId: 'dengue',
      mode: 'PUBLIC_DEMO',
    });
  }
}
