import { describe, expect, it } from 'vitest';

import { ProjectService } from './project-service.js';

const projectId = '00000000-0000-4000-8000-000000000001';
const proteinId = '00000000-0000-4000-8000-000000000002';
const now = new Date('2026-07-24T00:00:00.000Z');

function fixture() {
  const projects: Record<string, unknown>[] = [];
  const proteins: Record<string, unknown>[] = [];
  const repositories = {
    projects: {
      findById: async (id: string) => projects.find((project) => project.id === id) ?? null,
      listPage: async () => ({ items: [], nextCursor: null }),
      countAll: async () => projects.length,
      deleteTree: async (id: string) => {
        const index = projects.findIndex((project) => project.id === id);
        if (index >= 0) projects.splice(index, 1);
      },
      create: async (input: Record<string, unknown>) => {
        const value = {
          id: projectId,
          ...input,
          organism: input.organism ?? null,
          proteinName: input.proteinName ?? null,
          description: input.description ?? null,
          createdAt: now,
          updatedAt: now,
        };
        projects.push(value);
        return value;
      },
    },
    proteins: {
      create: async (input: Record<string, unknown>) => {
        const value = { id: proteinId, ...input, createdAt: now };
        proteins.push(value);
        return value;
      },
      findCurrentByProject: async (id: string) =>
        proteins.find((protein) => protein.projectId === id) ?? null,
    },
    runs: {
      listSummariesByProject: async () => [],
      countByStatus: async () => ({}),
      countCreatedSince: async () => 0,
    },
    candidates: { countAll: async () => 0 },
    artifacts: { countAll: async () => 0, listByProject: async () => [] },
    approvals: { findLatest: async () => null },
  };
  const manager = {
    run: async <T>(work: (value: typeof repositories) => Promise<T>) => work(repositories),
  };
  const artifactStore = { remove: async () => undefined };
  return {
    projects,
    proteins,
    service: new ProjectService(
      repositories as never,
      manager as never,
      artifactStore as never,
      () => now,
    ),
  };
}

describe('ProjectService', () => {
  it('atomically validates and stores a project with one protein input', async () => {
    const { service, projects, proteins } = fixture();
    const result = await service.create({
      name: 'Dengue project',
      organism: 'Dengue virus',
      proteinName: 'Envelope',
      fasta: '>envelope\nACDEFGHIK',
    });
    expect(result).toMatchObject({
      project: { id: projectId },
      protein: { id: proteinId, length: 9 },
    });
    expect(projects).toHaveLength(1);
    expect(proteins).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain('ACDEFGHIK');
  });

  it('rejects invalid FASTA before writing anything', async () => {
    const { service, projects } = fixture();
    await expect(
      service.create({ name: 'Invalid', organism: 'Virus', proteinName: 'P', fasta: 'ACGT' }),
    ).rejects.toMatchObject({ code: 'INVALID_FASTA', statusCode: 422 });
    expect(projects).toHaveLength(0);
  });

  it('requires exact project-name confirmation before controlled deletion', async () => {
    const { service } = fixture();
    await service.create({
      name: 'Delete me',
      organism: 'Virus',
      proteinName: 'P',
      fasta: '>p\nACDEFGHIK',
    });
    await expect(
      service.delete({ projectId, confirmation: 'DELETE', expectedProjectName: 'wrong' }),
    ).rejects.toMatchObject({ code: 'PROJECT_NAME_MISMATCH', statusCode: 409 });
    await expect(
      service.delete({ projectId, confirmation: 'DELETE', expectedProjectName: 'Delete me' }),
    ).resolves.toEqual({ projectId, deleted: true });
  });
});
