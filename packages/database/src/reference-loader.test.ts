import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, describe, expect, it } from 'vitest';

import {
  DEFAULT_REFERENCE_DIRECTORY,
  findHlaAllele,
  loadReferenceBundle,
  validateHlaSelection,
} from './reference-loader.js';

const temporaryDirectories: string[] = [];

async function copyReferenceDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'immunograph-reference-'));
  temporaryDirectories.push(directory);
  await cp(DEFAULT_REFERENCE_DIRECTORY, directory, { recursive: true });
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) =>
        rm(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }),
      ),
  );
});

describe('reference bundle loader', () => {
  it('loads the complete versioned reference bundle', async () => {
    const bundle = await loadReferenceBundle();

    expect(bundle.manifest.bundleVersion).toBe('v1');
    expect(bundle.aminoAcids.id).toBe('amino-acids');
    expect(bundle.fastaRules.id).toBe('fasta-validation-rules');
    expect(bundle.hlaRegistry.id).toBe('hla-alleles');
    expect(bundle.normalizationProfiles.id).toBe('normalization-profiles');
    expect(bundle.connectorRegistry.id).toBe('connector-registry');
    expect(bundle.demoProteins.id).toBe('demo-proteins');
    expect(bundle.demoProteins.proteins).toHaveLength(5);
    expect(bundle.demoProteins.proteins.every((protein) => protein.sequence.length > 0)).toBe(true);
  });

  it('contains all 20 standard amino acids and explicitly disallows ambiguous residues', async () => {
    const bundle = await loadReferenceBundle();
    const strictResidues = bundle.aminoAcids.residues
      .filter((residue) => residue.standard && residue.allowedInStrictProfile)
      .map((residue) => residue.oneLetter)
      .sort();

    expect(strictResidues.join('')).toBe('ACDEFGHIKLMNPQRSTVWY');
    for (const symbol of ['B', 'J', 'X', 'Z']) {
      expect(bundle.aminoAcids.residues).toContainEqual(
        expect.objectContaining({
          oneLetter: symbol,
          standard: false,
          allowedInStrictProfile: false,
        }),
      );
      expect(bundle.fastaRules.ambiguousResidues).toContain(symbol);
    }
  });

  it('declares the approved single terminal-stop normalization behavior', async () => {
    const bundle = await loadReferenceBundle();

    expect(bundle.fastaRules.stripSingleTerminalStop).toBe(true);
  });

  it('resolves canonical HLA names and aliases without case sensitivity', async () => {
    const bundle = await loadReferenceBundle();

    expect(findHlaAllele(bundle, 'HLA-A*02:01')?.allele).toBe('HLA-A*02:01');
    expect(findHlaAllele(bundle, ' a0201 ')?.allele).toBe('HLA-A*02:01');
    expect(findHlaAllele(bundle, 'not-an-allele')).toBeNull();
  });

  it('reports class, method, version, and peptide-length incompatibilities', async () => {
    const bundle = await loadReferenceBundle();
    const compatible = {
      allele: 'A0201',
      mhcClass: 'I' as const,
      connectorId: 'iedb',
      method: 'iedb-recommended',
      methodVersion: '2023.09',
      peptideLengths: [8, 9, 10, 11],
    };

    expect(validateHlaSelection(bundle, compatible)).toEqual([]);
    expect(
      validateHlaSelection(bundle, { ...compatible, mhcClass: 'II' }).map((issue) => issue.code),
    ).toContain('CLASS_MISMATCH');
    expect(
      validateHlaSelection(bundle, { ...compatible, method: 'unknown' }).map((issue) => issue.code),
    ).toContain('UNSUPPORTED_METHOD');
    expect(
      validateHlaSelection(bundle, { ...compatible, methodVersion: 'old' }).map(
        (issue) => issue.code,
      ),
    ).toContain('UNSUPPORTED_METHOD_VERSION');
    expect(
      validateHlaSelection(bundle, { ...compatible, peptideLengths: [12] }).map(
        (issue) => issue.code,
      ),
    ).toContain('UNSUPPORTED_PEPTIDE_LENGTH');
  });

  it('allows only explicitly synthetic, non-scientific finite unit-interval frequencies', async () => {
    const bundle = await loadReferenceBundle();
    const frequencies = bundle.hlaRegistry.alleles.flatMap(
      (allele) => allele.populationFrequencies ?? [],
    );

    expect(frequencies.length).toBeGreaterThan(0);
    for (const frequency of frequencies) {
      expect(frequency).toMatchObject({ sourceKind: 'SYNTHETIC', scientificUse: false });
      expect(frequency.populationId).toMatch(/^synthetic:/);
      expect(frequency.sourceId).toMatch(/^urn:immunograph:synthetic:/);
      expect(Number.isFinite(frequency.value)).toBe(true);
      expect(frequency.value).toBeGreaterThanOrEqual(0);
      expect(frequency.value).toBeLessThanOrEqual(1);
    }
  });

  it('rejects a semantically changed reference file', async () => {
    const directory = await copyReferenceDirectory();
    const path = join(directory, 'amino-acids.v1.json');
    const contents = await readFile(path, 'utf8');
    await writeFile(path, contents.replace('Alanine', 'Changed alanine'), 'utf8');

    await expect(loadReferenceBundle(directory)).rejects.toThrow(/hash mismatch.*amino-acids/i);
  });

  it('rejects a changed manifest hash', async () => {
    const directory = await copyReferenceDirectory();
    const path = join(directory, 'manifest.v1.json');
    const manifest = JSON.parse(await readFile(path, 'utf8')) as {
      entries: Array<{ sha256: string }>;
    };
    manifest.entries[0]!.sha256 = '0'.repeat(64);
    await writeFile(path, JSON.stringify(manifest), 'utf8');

    await expect(loadReferenceBundle(directory)).rejects.toThrow(/hash mismatch/i);
  });
});
