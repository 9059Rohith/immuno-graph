import {
  Activity,
  FileText,
  FolderKanban,
  Gauge,
  Info,
  LayoutDashboard,
  ListOrdered,
  Network,
  Settings,
  Workflow,
  Cuboid,
  Box,
  LogOut,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { matchPath, NavLink, useLocation } from 'react-router-dom';
import { runtimeSettingsSchema } from '@immunograph/shared';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { apiRequest } from '@/lib/api-client';
import { useProject, useRun } from '@/features/data-hooks';
import { useAuth } from '@/features/auth';
import { useJudgeMode } from '@/features/judge-mode';

const coreWorkspace = [
  { label: 'Dashboard', to: '/workspace', icon: LayoutDashboard },
  { label: 'Projects', to: '/workspace', icon: FolderKanban },
];
const experimentalWorkspace = [
  { label: '3D Structures', to: '/structures', icon: Cuboid },
  { label: 'Docking Lab', to: '/docking', icon: Box },
];
const system = [
  { label: 'Diagnostics', to: '/system/diagnostics', icon: Gauge },
  { label: 'About', to: '/system/about', icon: Info },
];

export function AppShell({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const judge = useJudgeMode();
  const workspace = judge.active ? coreWorkspace : [...coreWorkspace, ...experimentalWorkspace];
  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader className="border-b border-sidebar-border px-3 py-4">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
              <Network aria-hidden="true" />
            </span>
            <div className="grid text-left group-data-[collapsible=icon]:hidden">
              <span className="font-semibold">ImmunoGraph</span>
              <span className="text-xs text-sidebar-foreground/70">Research workspace</span>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <NavGroup label="Workspace" items={workspace} />
          <NavGroup label="System" items={system} />
          <ProjectNavigation />
        </SidebarContent>
        <SidebarFooter>
          <ApiConnectionStatus />
          {judge.active ? (
            <div className="mt-2 rounded-lg border border-sidebar-border bg-sidebar-accent px-2 py-2 text-xs">
              <strong className="block">Judge Mode</strong>
              <span className="text-sidebar-foreground/70">Synthetic · expires in 24h</span>
            </div>
          ) : (
            <button
              className="mt-2 flex items-center gap-2 rounded-lg px-2 py-2 text-xs hover:bg-sidebar-accent"
              onClick={() => void auth.logout()}
            >
              <LogOut className="size-4" /> Sign out
            </button>
          )}
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 items-center border-b bg-card/90 px-4 backdrop-blur-md md:px-6">
          <SidebarTrigger aria-label="Toggle navigation" />
          <span className="ml-3 text-sm text-muted-foreground">
            {judge.active ? 'Judge Mode · synthetic fixture' : 'Research workspace'}
          </span>
          <span className="ml-auto hidden text-sm font-medium sm:inline">
            {judge.active ? 'No account required' : auth.user?.displayName}
          </span>
        </header>
        <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-5 px-4 py-5 md:px-7 md:py-6">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function ProjectNavigation() {
  const { pathname } = useLocation();
  const projectMatch = matchPath('/projects/:projectId/*', pathname);
  const runMatch = matchPath('/runs/:runId/*', pathname);
  const routedProjectId = projectMatch?.params.projectId ?? '';
  const routedRunId = runMatch?.params.runId ?? '';
  const project = useProject(routedProjectId);
  const run = useRun(routedRunId);
  const projectId = routedProjectId || run.data?.projectId || '';
  const runId = routedRunId || project.data?.runs[0]?.id || '';
  if (projectId === '') return null;

  const items = [
    { label: 'Overview', to: `/projects/${projectId}`, icon: FolderKanban },
    ...(runId === ''
      ? []
      : [
          { label: 'Workflow', to: `/runs/${runId}/workflow`, icon: Workflow },
          { label: 'Candidates', to: `/runs/${runId}/candidates`, icon: ListOrdered },
          { label: 'Evidence', to: `/runs/${runId}/evidence`, icon: Network },
          { label: 'Reports', to: `/runs/${runId}/reports`, icon: FileText },
        ]),
    { label: 'Settings', to: `/projects/${projectId}/settings`, icon: Settings },
  ];
  return <NavGroup label="Project workspace" items={items} />;
}

function ApiConnectionStatus() {
  const runtime = useQuery({
    queryKey: ['runtime'],
    queryFn: () => apiRequest('/settings/runtime', runtimeSettingsSchema),
    retry: false,
    staleTime: 30_000,
  });
  const label = runtime.isPending
    ? 'Checking API'
    : runtime.isError
      ? 'API unavailable'
      : 'API connected';
  return (
    <div className="flex items-center gap-2 text-xs" aria-live="polite">
      <Activity aria-hidden="true" /> {label}
    </div>
  );
}

type NavigationItem = { label: string; to: string; icon: typeof LayoutDashboard };
function NavGroup({ label, items }: { label: string; items: NavigationItem[] }) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map(({ label: itemLabel, to, icon: Icon }) => (
            <SidebarMenuItem key={itemLabel}>
              <SidebarMenuButton asChild tooltip={itemLabel}>
                <NavLink end={to === '/'} to={to}>
                  <Icon aria-hidden="true" />
                  <span>{itemLabel}</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
