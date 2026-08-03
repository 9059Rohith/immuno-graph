/* eslint-disable react-refresh/only-export-components -- provider and hook share one feature boundary. */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { demoWorkspaceSchema } from '@immunograph/shared';
import { z } from 'zod';

import { apiJson, apiRequest } from '@/lib/api-client';

const STORAGE_KEY = 'immunograph.judge-workspace.v1';
const storedWorkspaceSchema = demoWorkspaceSchema.pick({
  projectId: true,
  runId: true,
  expiresAt: true,
});
type StoredWorkspace = z.infer<typeof storedWorkspaceSchema>;

interface JudgeModeValue {
  workspace: StoredWorkspace | null;
  active: boolean;
  pending: boolean;
  error: string | null;
  startJudgeDemo(): Promise<void>;
  clearJudgeDemo(): void;
}

const JudgeModeContext = createContext<JudgeModeValue | null>(null);

function readWorkspace(): StoredWorkspace | null {
  const value = sessionStorage.getItem(STORAGE_KEY);
  if (value === null) return null;
  try {
    const parsed = storedWorkspaceSchema.parse(JSON.parse(value));
    if (new Date(parsed.expiresAt).getTime() > Date.now()) return parsed;
  } catch {
    // Corrupt or outdated browser state is intentionally discarded.
  }
  sessionStorage.removeItem(STORAGE_KEY);
  return null;
}

export function JudgeModeProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState<StoredWorkspace | null>(readWorkspace);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startJudgeDemo = useCallback(async () => {
    setPending(true);
    setError(null);
    try {
      const created = await apiRequest('/demo/start', demoWorkspaceSchema, apiJson('POST', {}));
      const stored = storedWorkspaceSchema.parse({
        projectId: created.projectId,
        runId: created.runId,
        expiresAt: created.expiresAt,
      });
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
      setWorkspace(stored);
      navigate(`/projects/${stored.projectId}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The judge demo could not be started.');
    } finally {
      setPending(false);
    }
  }, [navigate]);

  const clearJudgeDemo = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setWorkspace(null);
  }, []);
  const value = useMemo<JudgeModeValue>(
    () => ({
      workspace,
      active: workspace !== null,
      pending,
      error,
      startJudgeDemo,
      clearJudgeDemo,
    }),
    [workspace, pending, error, startJudgeDemo, clearJudgeDemo],
  );

  return <JudgeModeContext.Provider value={value}>{children}</JudgeModeContext.Provider>;
}

export function useJudgeMode(): JudgeModeValue {
  const value = useContext(JudgeModeContext);
  if (value === null) throw new Error('useJudgeMode must be used inside JudgeModeProvider.');
  return value;
}
