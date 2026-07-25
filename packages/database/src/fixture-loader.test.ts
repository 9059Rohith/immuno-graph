import { mkdtemp, readFile, writeFile, cp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_FIXTURE_DIRECTORY,
  fixtureManifestSummary,
  loadFixtureRegistry,
  matchFixture,
} from './fixture-loader.js';
import type { FixtureMatchQuery } from './fixture-validation.js';

const DISCLAIMER =
  'Computational demonstration only. Synthetic sequences, scores, rankings, and coverage are not experimental, clinical, efficacy, or pathogen-reference results.';

function changedQuery(
  query: FixtureMatchQuery,
  change: Partial<FixtureMatchQuery>,
): FixtureMatchQuery {
  return { ...query, ...change };
}

describe('synthetic exact-match fixture registry', () => {
  it('loads three approved cases with explicit synthetic-only provenance', async () => {
    const registry = await loadFixtureRegistry();

    expect(registry.cases.map(({ fixtureId }) => fixtureId).sort()).toEqual([
      'covid-spike',
      'dengue',
      'influenza',
    ]);

    for (const fixtureCase of registry.cases) {
      expect(fixtureCase.reviewStatus).toBe('APPROVED');
      expect(fixtureCase.sourceKind).toBe('SYNTHETIC');
      expect(fixtureCase.scientificUse).toBe(false);
      expect(fixtureCase.disclaimer).toBe(DISCLAIMER);
      expect(fixtureCase.fasta.header.startsWith('SYNTHETIC_DEMO')).toBe(true);
      expect(fixtureCase.fasta.sequence).toMatch(/^[ACDEFGHIKLMNPQRSTVWY]+$/);
      expect(fixtureCase.metadata.sequenceNature).toBe('SYNTHETIC_NOT_PATHOGEN_REFERENCE');

      for (const observation of fixtureCase.expectedCandidates.observations) {
        expect(observation.sourceStatus).toBe('FIXTURE');
        expect(observation.provenance).toMatchObject({
          sourceKind: 'SYNTHETIC',
          scientificUse: false,
          fixtureId: fixtureCase.fixtureId,
        });
      }

      expect(fixtureCase.expectedCandidates.bcell.method).toBe('GraphBepi');
      expect(fixtureCase.expectedCandidates.bcell.sourceStatus).toBe('FIXTURE');
      expect(fixtureCase.expectedCandidates.coverage.provenance).toMatchObject({
        sourceKind: 'SYNTHETIC',
        scientificUse: false,
        sourceStatus: 'FIXTURE',
      });
      expect(fixtureCase.expectedReport).toMatchObject({
        sourceKind: 'SYNTHETIC',
        scientificUse: false,
        disclaimer: DISCLAIMER,
      });
    }
  });

  it('matches every selector exactly while treating method, allele, and length sets as unordered', async () => {
    const registry = await loadFixtureRegistry();

    for (const fixtureCase of registry.cases) {
      for (const selector of fixtureCase.selectors) {
        expect(matchFixture(registry, selector)?.fixtureId).toBe(fixtureCase.fixtureId);
        expect(
          matchFixture(registry, {
            ...selector,
            methods: [...selector.methods].reverse(),
            alleles: [...selector.alleles].reverse(),
            peptideLengths: [...selector.peptideLengths].reverse(),
          })?.fixtureId,
        ).toBe(fixtureCase.fixtureId);
      }
    }
  });

  it('matches the shipped default run configuration for every demo protein', async () => {
    const registry = await loadFixtureRegistry();
    const emptyParametersHash = '44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a';

    for (const fixtureCase of registry.cases) {
      const common = {
        proteinSha256: fixtureCase.proteinSha256,
        parametersHash: emptyParametersHash,
        outputSchemaVersion: 'prediction-observation.v1',
        runProfile: {
          ruleProfileVersion: 'mvp-v1.0',
          rankingProfileVersion: 'mvp-v1.0',
        },
      } as const;
      const defaultQueries: FixtureMatchQuery[] = [
        {
          ...common,
          track: 'MHCI',
          methods: [{ method: 'iedb-recommended', version: '2023.09' }],
          alleles: ['HLA-A*02:01'],
          peptideLengths: [9, 10],
        },
        {
          ...common,
          track: 'MHCII',
          methods: [{ method: 'iedb-recommended', version: '2023.09' }],
          alleles: ['HLA-DRB1*04:01'],
          peptideLengths: [15],
        },
        {
          ...common,
          track: 'BCELL',
          methods: [{ method: 'graphbepi', version: 'synthetic-fixture-v1' }],
          alleles: [],
          peptideLengths: [],
        },
      ];

      for (const query of defaultQueries) {
        expect(matchFixture(registry, query)?.fixtureId).toBe(fixtureCase.fixtureId);
      }
    }
  });

  it('rejects a change in every required exact-match dimension', async () => {
    const registry = await loadFixtureRegistry();
    const query = registry.cases[0]!.selectors[0]!;
    const differentHash = 'f'.repeat(64) === query.proteinSha256 ? 'e'.repeat(64) : 'f'.repeat(64);

    const mismatches: FixtureMatchQuery[] = [
      changedQuery(query, { proteinSha256: differentHash }),
      changedQuery(query, { track: query.track === 'MHCI' ? 'MHCII' : 'MHCI' }),
      changedQuery(query, {
        methods: query.methods.map((method, index) =>
          index === 0 ? { ...method, method: `${method.method}-changed` } : method,
        ),
      }),
      changedQuery(query, {
        methods: query.methods.map((method, index) =>
          index === 0 ? { ...method, version: `${method.version}-changed` } : method,
        ),
      }),
      changedQuery(query, { alleles: [...query.alleles, 'HLA-A*99:99'] }),
      changedQuery(query, { peptideLengths: [...query.peptideLengths, 11] }),
      changedQuery(query, { parametersHash: differentHash }),
      changedQuery(query, { outputSchemaVersion: `${query.outputSchemaVersion}-changed` }),
      changedQuery(query, {
        runProfile: { ...query.runProfile, ruleProfileVersion: 'changed-v1' },
      }),
      changedQuery(query, {
        runProfile: { ...query.runProfile, rankingProfileVersion: 'changed-v1' },
      }),
    ];

    for (const mismatch of mismatches) expect(matchFixture(registry, mismatch)).toBeNull();
  });

  it('never selects a fixture unless its review status is APPROVED', async () => {
    const registry = await loadFixtureRegistry();
    const query = registry.cases[0]!.selectors[0]!;
    const unapproved = structuredClone(registry);
    unapproved.cases[0]!.reviewStatus = 'PENDING';

    expect(matchFixture(unapproved, query)).toBeNull();
  });

  it('rejects fixture content changed after manifest hashes were frozen', async () => {
    const temporaryRoot = await mkdtemp(join(tmpdir(), 'immunograph-fixtures-'));
    await cp(DEFAULT_FIXTURE_DIRECTORY, temporaryRoot, { recursive: true });
    const casePath = join(temporaryRoot, 'covid-spike', 'case.json');
    const contents = await readFile(casePath, 'utf8');
    await writeFile(casePath, contents.replace('COVID-like UI scenario', 'changed UI scenario'));

    await expect(loadFixtureRegistry(temporaryRoot)).rejects.toThrow(/hash mismatch/i);
  });

  it('returns a safe manifest summary without paths, FASTA, or prediction payloads', async () => {
    const summary = fixtureManifestSummary(await loadFixtureRegistry());
    const serialized = JSON.stringify(summary);

    expect(summary.entries).toHaveLength(3);
    expect(summary.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(serialized).not.toContain('sequence');
    expect(serialized).not.toContain('observations');
    expect(serialized).not.toContain('expected-candidates.json');
    expect(serialized).not.toContain('input.fasta');
  });
});
