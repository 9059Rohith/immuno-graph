import { describe, expect, it } from 'vitest';

import { artifactListSchema } from '@immunograph/shared';

import { mapArtifactList } from './report-mapper.js';

describe('report mapper', () => {
  it('exposes safe artifact metadata without the relative path', () => {
    const mapped = mapArtifactList([
      {
        id: '00000000-0000-4000-8000-000000000004',
        runId: 'run-id',
        type: 'JSON',
        format: 'JSON',
        relativePath: 'run/report.json',
        mimeType: 'application/json',
        byteSize: 10,
        sha256: 'a'.repeat(64),
        templateVersion: 'v1',
        createdAt: new Date('2026-07-24T00:00:00.000Z'),
      },
    ]);
    expect(artifactListSchema.parse(mapped)).toEqual(mapped);
    expect(JSON.stringify(mapped)).not.toContain('run/report.json');
  });
});
