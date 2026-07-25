import { createHash } from 'node:crypto';

process.env.DATABASE_URL ??= 'file:./immunograph.db';

const { PrismaClient } = await import('@prisma/client');
const { initializeDatabase } = await import('./client.js');
const { loadDefaultProfileSnapshot } = await import('./profile-loader.js');
const { loadFixtureRegistry } = await import('./fixture-loader.js');
const { createRepositories } = await import('./repositories.js');
const { createDemoRunSnapshot, removeLegacyDemoSeed } = await import('./seed-support.js');

const client = new PrismaClient();
const repositories = createRepositories(client);

const hash = (value: string): string => createHash('sha256').update(value).digest('hex');

const DEMO_PROJECT_ID = '00000000-0000-4000-8000-000000000101';
const DEMO_PROTEIN_IDS = [
  '00000000-0000-4000-8000-000000000111',
  '00000000-0000-4000-8000-000000000112',
  '00000000-0000-4000-8000-000000000113',
] as const;
const DEMO_RUN_ID = '00000000-0000-4000-8000-000000000121';

async function seed(): Promise<void> {
  await initializeDatabase(client);
  const [profiles, fixtureRegistry] = await Promise.all([
    loadDefaultProfileSnapshot(),
    loadFixtureRegistry(),
  ]);
  const demoProteins = fixtureRegistry.cases.map((fixture, index) => ({
    id: DEMO_PROTEIN_IDS[index]!,
    header: fixture.fasta.header,
    sequence: fixture.fasta.sequence,
  }));
  await client.$transaction((transaction) => removeLegacyDemoSeed(createRepositories(transaction)));
  const project = await client.project.upsert({
    create: {
      id: DEMO_PROJECT_ID,
      name: 'ImmunoGraph MVP Demo',
      description: 'Local, non-scientific demonstration workspace.',
    },
    update: {
      name: 'ImmunoGraph MVP Demo',
      description: 'Local, non-scientific demonstration workspace.',
    },
    where: { id: DEMO_PROJECT_ID },
  });

  for (const protein of demoProteins) {
    const originalFasta = `>${protein.header}\n${protein.sequence}`;
    await client.proteinInput.upsert({
      create: {
        id: protein.id,
        projectId: project.id,
        originalFasta,
        header: protein.header,
        normalizedSequence: protein.sequence,
        sequenceLength: protein.sequence.length,
        sha256: hash(protein.sequence),
        validationProfileVersion: 'mvp-v1.0',
      },
      update: {},
      where: { id: protein.id },
    });
  }

  const configurationJson = JSON.stringify(createDemoRunSnapshot(profiles));
  await client.workflowRun.upsert({
    create: {
      id: DEMO_RUN_ID,
      projectId: project.id,
      proteinInputId: demoProteins[0]!.id,
      revision: 1,
      status: 'DRAFT',
      configurationJson,
      configurationHash: hash(configurationJson),
      ruleProfileVersion: profiles.biologicalConstraints.version,
      rankingProfileVersion: profiles.ranking.version,
    },
    update: {
      configurationJson,
      configurationHash: hash(configurationJson),
      ruleProfileVersion: profiles.biologicalConstraints.version,
      rankingProfileVersion: profiles.ranking.version,
    },
    where: { id: DEMO_RUN_ID },
  });

  await repositories.runs.findById(DEMO_RUN_ID);
  process.stdout.write(
    'Seeded immutable profile metadata, one demo project, and three demo proteins.\n',
  );
}

try {
  await seed();
} finally {
  await client.$disconnect();
}
