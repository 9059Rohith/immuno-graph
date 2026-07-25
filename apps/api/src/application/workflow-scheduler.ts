export type SchedulableStageStatus =
  'PENDING' | 'READY' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'SKIPPED';

export interface SchedulableStage {
  key: string;
  status: SchedulableStageStatus;
  dependencies: readonly string[];
}

const satisfiedStatuses = new Set<SchedulableStageStatus>(['SUCCEEDED', 'SKIPPED']);

export function findReadyStageKeys(stages: readonly SchedulableStage[]): string[] {
  const statusByKey = new Map(stages.map((stage) => [stage.key, stage.status]));
  return stages
    .filter(
      (stage) =>
        stage.status === 'PENDING' &&
        stage.dependencies.every((dependency) => {
          const status = statusByKey.get(dependency);
          if (status === undefined) {
            throw new Error(`Unknown workflow dependency: ${dependency}`);
          }
          return satisfiedStatuses.has(status);
        }),
    )
    .map(({ key }) => key)
    .sort();
}

export async function runWithConcurrencyLimit<T, R>(
  values: readonly T[],
  limit: number,
  operation: (value: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError('Concurrency limit must be a positive integer');
  }
  const results = new Array<PromiseSettledResult<R>>(values.length);
  let nextIndex = 0;
  const worker = async (): Promise<void> => {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      try {
        results[index] = { status: 'fulfilled', value: await operation(values[index]!, index) };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, values.length) }, async () => {
      await worker();
    }),
  );
  return results;
}
