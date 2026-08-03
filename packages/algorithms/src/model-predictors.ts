/**
 * Small, dependency-free scoring heads used by the offline hackathon demo.
 *
 * The coefficients are fixed, versioned demonstration parameters. This
 * repository contains no training dataset or validation experiment for them.
 * They keep replay fast and reproducible in Node, Docker, and the browser, but
 * must never be presented as trained or experimentally validated predictors.
 */

export const ML_MODEL_ID = 'immunograph-deterministic-linear-demo-head';
export const ML_MODEL_VERSION = '1.0.0';
export const DL_MODEL_ID = 'immunograph-deterministic-nonlinear-demo-head';
export const DL_MODEL_VERSION = '1.0.0';

const AMINO_ACIDS = /^[ACDEFGHIKLMNPQRSTVWY]+$/u;
const FEATURE_COUNT = 18;

// Compact biochemical descriptors. Values are intentionally normalized to
// approximately [-1, 1] so the demonstration scorer remains numerically stable in JS.
const HYDROPHOBIC = new Set('AILMFWVY'.split(''));
const AROMATIC = new Set('FWY'.split(''));
const POSITIVE = new Set('KRH'.split(''));
const NEGATIVE = new Set('DE'.split(''));
const POLAR = new Set('STNQ'.split(''));
const FLEXIBLE = new Set('GP'.split(''));

const ML_WEIGHTS = [
  0.18, 0.46, -0.31, 0.24, -0.16, 0.27, -0.21, 0.13, 0.19, -0.12, 0.17, -0.09, 0.08, 0.12, -0.11,
  0.07, 0.09, -0.06,
] as const;
const ML_BIAS = -0.04;

// A deterministic 18 -> 8 -> 4 -> 1 nonlinear head. Keeping coefficients inline
// avoids a runtime artifact loader, filesystem I/O, and heavyweight dependencies.
const DL_HIDDEN_1 = [
  [
    0.14, 0.32, -0.22, 0.18, -0.11, 0.21, -0.16, 0.08, 0.12, -0.09, 0.16, -0.13, 0.07, 0.11, -0.08,
    0.05, 0.09, -0.04,
  ],
  [
    -0.18, 0.24, 0.31, -0.16, 0.22, -0.14, 0.19, -0.12, 0.07, 0.15, -0.11, 0.09, -0.06, 0.13, 0.1,
    -0.08, 0.06, 0.12,
  ],
  [
    0.27, -0.2, 0.12, 0.29, 0.16, -0.18, 0.1, 0.2, -0.14, 0.08, 0.12, -0.1, 0.15, -0.05, 0.09, 0.11,
    -0.07, 0.04,
  ],
  [
    -0.11, 0.17, -0.26, 0.2, 0.13, 0.24, -0.19, 0.09, 0.18, -0.12, 0.06, 0.14, -0.1, 0.08, 0.11,
    -0.09, 0.05, 0.16,
  ],
  [
    0.21, 0.15, 0.18, -0.23, 0.09, -0.17, 0.28, -0.13, 0.1, 0.2, -0.08, 0.11, -0.04, 0.07, 0.13,
    -0.06, 0.05, 0.12,
  ],
  [
    0.08, -0.13, 0.22, 0.16, -0.2, 0.19, 0.14, 0.24, -0.11, 0.07, 0.17, -0.09, 0.1, -0.12, 0.06,
    0.15, -0.05, 0.04,
  ],
  [
    -0.16, 0.2, 0.11, 0.14, 0.25, -0.12, 0.18, -0.08, 0.13, -0.16, 0.09, 0.1, -0.07, 0.12, -0.1,
    0.05, 0.08, 0.19,
  ],
  [
    0.19, 0.09, -0.15, 0.23, 0.12, 0.16, -0.1, 0.18, 0.2, -0.07, 0.11, -0.14, 0.06, 0.09, 0.15,
    -0.04, 0.1, 0.13,
  ],
] as const;
const DL_HIDDEN_1_BIAS = [0.02, -0.03, 0.01, 0.04, -0.02, 0.01, -0.01, 0.02] as const;
const DL_HIDDEN_2 = [
  [0.22, -0.18, 0.27, 0.14, -0.2, 0.16, 0.11, 0.2],
  [-0.13, 0.25, 0.12, -0.22, 0.19, -0.15, 0.2, 0.1],
  [0.16, 0.11, -0.19, 0.24, 0.13, 0.21, -0.12, 0.18],
  [0.2, -0.14, 0.18, 0.1, 0.22, -0.17, 0.15, 0.12],
] as const;
const DL_HIDDEN_2_BIAS = [0.01, -0.02, 0.03, 0] as const;
const DL_OUTPUT = [0.31, -0.24, 0.28, 0.19] as const;
const DL_OUTPUT_BIAS = 0.02;

export interface BindingModelScores {
  mlScore: number;
  dlScore: number;
  ensembleScore: number;
  uncertainty: number;
}

export interface BindingModelInput {
  peptide: string;
  allele: string;
  candidateType: 'MHCI' | 'MHCII';
}

const clamp = (value: number): number => Math.max(0, Math.min(1, value));
const round = (value: number): number => Number(value.toFixed(8));
const sigmoid = (value: number): number => 1 / (1 + Math.exp(-value));
const tanh = (value: number): number => Math.tanh(value);
function alleleFeatures(allele: string): number[] {
  const normalized = allele.trim().toUpperCase();
  const classValue =
    normalized.includes('DR') || normalized.includes('DQ') || normalized.includes('DP') ? 1 : 0;
  const locusValue = normalized.includes('A*')
    ? 0.8
    : normalized.includes('B*')
      ? 0.5
      : normalized.includes('C*')
        ? 0.2
        : -0.2;
  const digits = normalized.match(/\d+/gu)?.join('') ?? '0';
  const alleleNumber = Number.parseInt(digits.slice(-3), 10) || 0;
  return [classValue, locusValue, (alleleNumber % 17) / 8.5 - 1];
}

export function extractBindingFeatures(input: BindingModelInput): readonly number[] {
  const peptide = input.peptide.trim().toUpperCase();
  const allele = input.allele.trim();
  if (!AMINO_ACIDS.test(peptide))
    throw new Error('peptide must contain only canonical amino acids');
  if (allele.length === 0) throw new Error('allele is required');
  const residues = peptide.split('');
  const count = (set: Set<string>): number =>
    residues.filter((residue) => set.has(residue)).length / residues.length;
  const terminal = (set: Set<string>, index: number): number =>
    set.has(residues[index] ?? '') ? 1 : 0;
  const charge = count(POSITIVE) - count(NEGATIVE);
  const [classValue = 0, locusValue = 0, alleleNumber = 0] = alleleFeatures(allele);
  return [
    peptide.length <= 11 ? 1 : 0,
    peptide.length / 25,
    count(HYDROPHOBIC),
    count(AROMATIC),
    count(POSITIVE),
    count(NEGATIVE),
    count(POLAR),
    count(FLEXIBLE),
    charge,
    terminal(HYDROPHOBIC, 0),
    terminal(HYDROPHOBIC, residues.length - 1),
    terminal(POSITIVE, 0) - terminal(NEGATIVE, 0),
    terminal(POSITIVE, residues.length - 1) - terminal(NEGATIVE, residues.length - 1),
    classValue,
    locusValue,
    alleleNumber,
    input.candidateType === 'MHCI' ? 1 : 0,
    Math.abs(charge),
  ];
}

export function predictBindingModels(input: BindingModelInput): BindingModelScores {
  const features = extractBindingFeatures(input);
  const mlLogit =
    ML_BIAS + ML_WEIGHTS.reduce((sum, weight, index) => sum + weight * features[index]!, 0);
  const hidden1 = DL_HIDDEN_1.map((weights, row) =>
    tanh(
      DL_HIDDEN_1_BIAS[row]! +
        weights.reduce((sum, weight, index) => sum + weight * features[index]!, 0),
    ),
  );
  const hidden2 = DL_HIDDEN_2.map((weights, row) =>
    tanh(
      DL_HIDDEN_2_BIAS[row]! +
        weights.reduce((sum, weight, index) => sum + weight * hidden1[index]!, 0),
    ),
  );
  const mlScore = clamp(sigmoid(mlLogit));
  const dlScore = clamp(
    sigmoid(
      DL_OUTPUT_BIAS + DL_OUTPUT.reduce((sum, weight, index) => sum + weight * hidden2[index]!, 0),
    ),
  );
  const ensembleScore = clamp(0.45 * mlScore + 0.55 * dlScore);
  return {
    mlScore: round(mlScore),
    dlScore: round(dlScore),
    ensembleScore: round(ensembleScore),
    uncertainty: round(Math.abs(mlScore - dlScore)),
  };
}

export const MODEL_FEATURE_COUNT = FEATURE_COUNT;
