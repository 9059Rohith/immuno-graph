import { lazy, Suspense, type ComponentType } from 'react';
import { Link, Route, Routes } from 'react-router-dom';

import { LoadingState } from '@/components/page-state';
import { Button } from '@/components/ui/button';
import { AuthPage } from '@/features/auth';

const AppShell = lazy(async () => ({ default: (await import('@/components/app-shell')).AppShell }));
const LandingPage = lazy(async () => ({
  default: (await import('@/features/landing-page')).LandingPage,
}));
const DashboardPage = lazy(async () => ({
  default: (await import('@/features/projects/dashboard-page')).DashboardPage,
}));
const DockingPage = lazy(async () => ({
  default: (await import('@/features/structural-pages')).DockingPage,
}));
const StructuresPage = lazy(async () => ({
  default: (await import('@/features/structural-pages')).StructuresPage,
}));
const TrustCenterPage = lazy(async () => ({
  default: (await import('@/features/trust-center-page')).TrustCenterPage,
}));
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
    <Suspense fallback={<LoadingState label="Loading page" />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/judge" element={<LandingPage />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/signup" element={<AuthPage mode="signup" />} />
        <Route
          path="*"
          element={
            <AppShell>
              <Suspense fallback={<LoadingState label="Loading workspace page" />}>
                <Routes>
                  <Route path="/workspace" element={<DashboardPage />} />
                  <Route path="/projects/new" element={<CreateProjectPage />} />
                  <Route path="/projects/:projectId" element={<ProjectPage />} />
                  <Route path="/projects/:projectId/settings" element={<ProjectSettingsPage />} />
                  <Route path="/runs/:runId" element={<RunPage />} />
                  <Route path="/runs/:runId/workflow" element={<WorkflowPage />} />
                  <Route path="/runs/:runId/candidates" element={<CandidatesPage />} />
                  <Route path="/runs/:runId/evidence" element={<EvidencePage />} />
                  <Route path="/runs/:runId/trust" element={<TrustCenterPage />} />
                  <Route path="/runs/:runId/reports" element={<ReportsPage />} />
                  <Route path="/system/diagnostics" element={<DiagnosticsPage />} />
                  <Route path="/system/about" element={<AboutPage />} />
                  <Route path="/structures" element={<StructuresPage />} />
                  <Route path="/docking" element={<DockingPage />} />
                  <Route
                    path="*"
                    element={
                      <section>
                        <h1 className="text-3xl font-semibold">Page not found</h1>
                        <Button asChild>
                          <Link to="/workspace">Return to Dashboard</Link>
                        </Button>
                      </section>
                    }
                  />
                </Routes>
              </Suspense>
            </AppShell>
          }
        />
      </Routes>
    </Suspense>
  );
}
