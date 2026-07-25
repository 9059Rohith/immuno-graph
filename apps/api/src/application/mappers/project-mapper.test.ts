import { describe, expect, it } from 'vitest';

import { createdProjectSchema } from '@immunograph/shared';

import { mapCreatedProject } from './project-mapper.js';

describe('project mapper', () => {
  it('returns metadata without exposing stored FASTA or normalized sequence', () => {
    const project = {
      id: '00000000-0000-4000-8000-000000000001',
      name: 'Demo',
      organism: 'Virus',
      proteinName: 'Envelope',
      description: null,
      createdAt: new Date('2026-07-24T00:00:00.000Z'),
      updatedAt: new Date('2026-07-24T00:00:00.000Z'),
    };
    const protein = {
      id: '00000000-0000-4000-8000-000000000002',
      projectId: project.id,
      originalFasta: '>secret\nACDEFGHIK',
      header: 'secret',
      normalizedSequence: 'ACDEFGHIK',
      sequenceLength: 9,
      sha256: 'a'.repeat(64),
      validationProfileVersion: 'mvp-v1.0',
      createdAt: project.createdAt,
    };

    const mapped = mapCreatedProject(project, protein);
    expect(createdProjectSchema.parse(mapped)).toEqual(mapped);
    expect(JSON.stringify(mapped)).not.toContain('ACDEFGHIK');
  });
});
