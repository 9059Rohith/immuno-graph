import { findHlaAllele, type ReferenceBundle, validateHlaSelection } from '@immunograph/database';

import { ApplicationError } from './errors.js';

export interface TrackSelection {
  candidateType: 'MHCI' | 'MHCII';
  alleles: readonly string[];
  methods: readonly string[];
  peptideLengths: readonly number[];
}

const uniqueStrings = (values: readonly string[]) =>
  [...new Set(values.map((value) => value.trim()))].sort((left, right) =>
    left.localeCompare(right),
  );

const uniqueNumbers = (values: readonly number[]) => [...new Set(values)].sort((a, b) => a - b);

export class ReferenceDataService {
  constructor(private readonly bundle: Promise<ReferenceBundle>) {}

  async fastaValidationOptions() {
    const { aminoAcids, fastaRules } = await this.bundle;
    return {
      alphabet: aminoAcids.residues
        .filter(({ allowedInStrictProfile }) => allowedInStrictProfile)
        .map(({ oneLetter }) => oneLetter)
        .sort(),
      maxBytes: fastaRules.maxBytes,
      maxResidues: fastaRules.maxResidues,
    };
  }

  async validateTrack(selection: TrackSelection): Promise<{
    alleles: string[];
    methods: string[];
    peptideLengths: number[];
  }> {
    const bundle = await this.bundle;
    const expectedClass = selection.candidateType === 'MHCI' ? 'I' : 'II';
    const alleles = uniqueStrings(selection.alleles).map((input) => {
      const record = findHlaAllele(bundle, input);
      if (record === null || record.mhcClass !== expectedClass) {
        throw new ApplicationError(
          'UNSUPPORTED_ALLELE',
          422,
          `${input} is not registered for ${selection.candidateType}.`,
          false,
          { alleles: [`${input} is not supported for ${selection.candidateType}.`] },
        );
      }
      return record.allele;
    });
    const methods = uniqueStrings(selection.methods);
    const peptideLengths = uniqueNumbers(selection.peptideLengths);

    for (const method of methods) {
      const registration = bundle.connectorRegistry.connectors
        .flatMap((connector) =>
          connector.methods.map((registeredMethod) => ({ connector, registeredMethod })),
        )
        .find(
          ({ registeredMethod }) =>
            registeredMethod.method === method &&
            registeredMethod.tracks.includes(selection.candidateType),
        );
      if (registration === undefined) {
        throw new ApplicationError(
          'UNSUPPORTED_METHOD',
          422,
          `${method} is not registered for ${selection.candidateType}.`,
          false,
          { methods: [`${method} is not supported for ${selection.candidateType}.`] },
        );
      }
      for (const allele of alleles) {
        const issue = validateHlaSelection(bundle, {
          allele,
          mhcClass: expectedClass,
          connectorId: registration.connector.connectorId,
          method,
          methodVersion: registration.registeredMethod.methodVersion,
          peptideLengths,
        }).find(({ code }) => code !== 'CLASS_MISMATCH');
        if (issue !== undefined) {
          const code =
            issue.code === 'UNSUPPORTED_PEPTIDE_LENGTH'
              ? 'UNSUPPORTED_PEPTIDE_LENGTH'
              : issue.code === 'UNSUPPORTED_ALLELE' || issue.code === 'CLASS_MISMATCH'
                ? 'UNSUPPORTED_ALLELE'
                : 'UNSUPPORTED_METHOD';
          const field = code === 'UNSUPPORTED_PEPTIDE_LENGTH' ? 'peptideLengths' : 'methods';
          throw new ApplicationError(code, 422, issue.message, false, { [field]: [issue.message] });
        }
      }
    }
    return { alleles, methods, peptideLengths };
  }

  async populationFrequency(alleleInput: string, populationId: string): Promise<number | null> {
    const bundle = await this.bundle;
    const allele = findHlaAllele(bundle, alleleInput);
    return (
      allele?.populationFrequencies?.find((frequency) => frequency.populationId === populationId)
        ?.value ?? null
    );
  }
}
