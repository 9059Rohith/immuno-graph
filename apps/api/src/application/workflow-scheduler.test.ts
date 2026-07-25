import { describe, expect, it } from 'vitest';

import { findReadyStageKeys, runWithConcurrencyLimit } from './workflow-scheduler.js';

describe('findReadyStageKeys', () => {
  it('returns deterministic pending stages whose dependencies succeeded or were skipped', () => {
    expect(
      findReadyStageKeys([
        { key: 'validate', status: 'SUCCEEDED', dependencies: [] },
        { key: 'optional', status: 'SKIPPED', dependencies: ['validate'] },
        { key: 'z', status: 'PENDING', dependencies: ['validate'] },
        { key: 'a', status: 'PENDING', dependencies: ['validate', 'optional'] },
        { key: 'blocked', status: 'PENDING', dependencies: ['running'] },
        { key: 'running', status: 'RUNNING', dependencies: ['validate'] },
      ]),
    ).toEqual(['a', 'z']);
  });

  it('fails closed for a malformed graph dependency', () => {
    expect(() =>
      findReadyStageKeys([{ key: 'candidate', status: 'PENDING', dependencies: ['missing'] }]),
    ).toThrow('Unknown workflow dependency');
  });
});

describe('runWithConcurrencyLimit', () => {
  it('bounds concurrency, preserves input order, and isolates failures', async () => {
    let active = 0;
    let maximumActive = 0;
    const results = await runWithConcurrencyLimit([1, 2, 3, 4], 2, async (value) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await Promise.resolve();
      active -= 1;
      if (value === 3) throw new Error('expected');
      return value * 2;
    });
    expect(maximumActive).toBe(2);
    expect(results.map(({ status }) => status)).toEqual([
      'fulfilled',
      'fulfilled',
      'rejected',
      'fulfilled',
    ]);
    expect(results[0]).toEqual({ status: 'fulfilled', value: 2 });
  });

  it.each([0, -1, 1.5])('rejects invalid limit %s', async (limit) => {
    await expect(runWithConcurrencyLimit([1], limit, async (value) => value)).rejects.toThrow(
      'positive integer',
    );
  });

  it('handles an empty workload', async () => {
    await expect(runWithConcurrencyLimit([], 2, async (value) => value)).resolves.toEqual([]);
  });
});
