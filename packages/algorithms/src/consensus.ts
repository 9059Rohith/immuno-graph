import { clamp01 } from './normalization.js';
import { assertFiniteNumber, assertUnitInterval } from './types.js';

export interface ConsensusObservation {
  observationId: string;
  normalizedScore: number;
  reliabilityWeight: number;
  required: boolean;
}

export interface ConsensusResult {
  weightedMean: number;
  weightedVariance: number;
  agreement: number;
  agreementStatus: 'SUFFICIENT_OBSERVATIONS' | 'INSUFFICIENT_OBSERVATIONS';
  completeness: number;
  consensus: number;
}

export function calculateConsensus(
  observations: readonly ConsensusObservation[],
  configuredRequiredWeight: number,
): ConsensusResult {
  assertFiniteNumber(configuredRequiredWeight, 'configured required weight');
  if (configuredRequiredWeight <= 0) {
    throw new RangeError('configured required weight must be greater than zero');
  }

  const ordered = [...observations].sort((left, right) =>
    left.observationId.localeCompare(right.observationId),
  );
  for (const observation of ordered) {
    assertUnitInterval(observation.normalizedScore, 'normalized score');
    assertFiniteNumber(observation.reliabilityWeight, 'reliability weight');
    if (observation.reliabilityWeight < 0) {
      throw new RangeError('reliability weights must be non-negative');
    }
  }

  const totalWeight = ordered.reduce((sum, observation) => sum + observation.reliabilityWeight, 0);
  if (totalWeight <= 0)
    throw new RangeError('Consensus requires positive total reliability weight');
  const weightedMean =
    ordered.reduce(
      (sum, observation) => sum + observation.reliabilityWeight * observation.normalizedScore,
      0,
    ) / totalWeight;
  const weightedVariance =
    ordered.reduce(
      (sum, observation) =>
        sum + observation.reliabilityWeight * (observation.normalizedScore - weightedMean) ** 2,
      0,
    ) / totalWeight;
  const agreement = clamp01(1 - 4 * weightedVariance);
  const presentRequiredWeight = ordered.reduce(
    (sum, observation) => sum + (observation.required ? observation.reliabilityWeight : 0),
    0,
  );
  const completeness = clamp01(presentRequiredWeight / configuredRequiredWeight);
  const consensus = weightedMean * (0.7 + 0.3 * agreement) * completeness;
  const contributingCount = ordered.filter(
    (observation) => observation.reliabilityWeight > 0,
  ).length;

  return {
    weightedMean,
    weightedVariance,
    agreement,
    agreementStatus:
      contributingCount < 2 ? 'INSUFFICIENT_OBSERVATIONS' : 'SUFFICIENT_OBSERVATIONS',
    completeness,
    consensus,
  };
}
