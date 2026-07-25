import { lazy, Suspense, type ComponentType } from 'react';
import { Link, Route, Routes } from 'react-router-dom';

import { AppShell } from '@/components/app-shell';
import { LoadingState } from '@/components/page-state';
import { Button } from '@/components/ui/button';
import { DashboardPage } from '@/features/projects/dashboard-page';
const pages = () => import('@/features/workspace-pages');
const lazyPage = <K extends keyof Awaited<ReturnType<typeof pages>>>(name: K) =>
  lazy(async () => ({ default: (await pages())[name] as ComponentType }));
const AboutPage = lazyPage('AboutPage');
const CandidatesPage = lazyPage('CandidatesPage');
const CreateProjectPage = lazyPage('CreateProjectPage');
const DiagnosticsPage = lazyPage('DiagnosticsPage');
const EvidencePage = lazyPage('EvidencePage');
const ProjectPage = lazyPage('ProjectPage');
const ProjectSettingsPage = lazyPage('ProjectSettingsPage');
const ReportsPage = lazyPage('ReportsPage');
const RunPage = lazyPage('RunPage');
const WorkflowPage = lazyPage('WorkflowPage');

export function App() {
  return (
    <AppShell>
      <Suspense fallback={<LoadingState label="Loading page" />}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/projects/new" element={<CreateProjectPage />} />
          <Route path="/projects/:projectId" element={<ProjectPage />} />
          <Route path="/projects/:projectId/settings" element={<ProjectSettingsPage />} />
          <Route path="/runs/:runId" element={<RunPage />} />
          <Route path="/runs/:runId/workflow" element={<WorkflowPage />} />
          <Route path="/runs/:runId/candidates" element={<CandidatesPage />} />
          <Route path="/runs/:runId/evidence" element={<EvidencePage />} />
          <Route path="/runs/:runId/reports" element={<ReportsPage />} />
          <Route path="/system/diagnostics" element={<DiagnosticsPage />} />
          <Route path="/system/about" element={<AboutPage />} />
          <Route
            path="*"
            element={
              <section>
                <h1 className="text-3xl font-semibold">Page not found</h1>
                <Button asChild>
                  <Link to="/">Return to Dashboard</Link>
                </Button>
              </section>
            }
          />
        </Routes>
      </Suspense>
    </AppShell>
  );
}
