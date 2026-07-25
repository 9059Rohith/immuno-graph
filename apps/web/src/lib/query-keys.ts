export const queryKeys = {
  projects: (cursor?: string) => ['projects', cursor ?? 'first'] as const,
  project: (projectId: string) => ['project', projectId] as const,
  run: (runId: string) => ['run', runId] as const,
  candidates: (runId: string) => ['candidates', runId] as const,
  artifacts: (runId: string) => ['artifacts', runId] as const,
  diagnostics: ['diagnostics'] as const,
};
