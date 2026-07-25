import type { ExecutionMode, RequestedExecutionMode, SourceStatus } from '@immunograph/shared';

export type EvidenceSource = 'CACHE' | 'LIVE' | 'SYNTHETIC' | 'FIXTURE';

export function resolveExecutionPlan(
  requestedMode: RequestedExecutionMode,
  fallbackPolicy: string,
  demoMode: boolean,
): EvidenceSource[] {
  if (requestedMode === 'SYNTHETIC') return demoMode ? ['SYNTHETIC'] : [];
  if (requestedMode === 'FIXTURE') {
    return permitsFixture(fallbackPolicy) ? ['FIXTURE'] : [];
  }
  if (requestedMode === 'LIVE') {
    if (fallbackPolicy === 'FIXTURE_ONLY') return [];
    return fallbackPolicy.startsWith('CACHE_') ? ['CACHE', 'LIVE'] : ['LIVE', 'CACHE'];
  }
  switch (fallbackPolicy) {
    case 'LIVE_ONLY':
      return ['LIVE'];
    case 'CACHE_THEN_LIVE':
      return ['CACHE', 'LIVE'];
    case 'CACHE_THEN_LIVE_THEN_FIXTURE':
      return ['CACHE', 'LIVE', ...(demoMode ? (['SYNTHETIC'] as const) : []), 'FIXTURE'];
    case 'LIVE_THEN_CACHE_THEN_FIXTURE':
      return ['LIVE', 'CACHE', ...(demoMode ? (['SYNTHETIC'] as const) : []), 'FIXTURE'];
    case 'FIXTURE_ONLY':
      return ['FIXTURE'];
    default:
      return [];
  }
}

export function permitsFixture(fallbackPolicy: string): boolean {
  return ['CACHE_THEN_LIVE_THEN_FIXTURE', 'LIVE_THEN_CACHE_THEN_FIXTURE', 'FIXTURE_ONLY'].includes(
    fallbackPolicy,
  );
}

export function deriveExecutionMode(statuses: readonly SourceStatus[]): ExecutionMode {
  const sources = new Set(
    statuses
      .filter((status) => status !== 'FAILED')
      .map((status) => (status === 'CACHED' ? 'LIVE' : status)),
  );
  if (sources.size !== 1) return 'HYBRID';
  const only = [...sources][0];
  if (only === 'SYNTHETIC' || only === 'FIXTURE') return only;
  return 'LIVE';
}

export function isFallbackEligible(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const category = 'category' in error ? error.category : undefined;
  const code = 'code' in error ? error.code : undefined;
  return (
    category === 'TIMEOUT' ||
    category === 'RATE_LIMIT' ||
    category === 'CONNECTOR' ||
    code === 'DEPENDENCY_UNAVAILABLE' ||
    code === 'SERVICE_UNAVAILABLE' ||
    code === 'FIXTURE_NOT_FOUND'
  );
}
