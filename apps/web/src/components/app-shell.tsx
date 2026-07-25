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

const workspace = [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard },
  { label: 'Projects', to: '/', icon: FolderKanban },
];
const system = [
  { label: 'Diagnostics', to: '/system/diagnostics', icon: Gauge },
  { label: 'About', to: '/system/about', icon: Info },
];

export function AppShell({ children }: { children: ReactNode }) {
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
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 items-center border-b bg-card px-4 md:px-6">
          <SidebarTrigger aria-label="Toggle navigation" />
          <span className="ml-3 text-sm text-muted-foreground">Research workspace</span>
        </header>
        <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-5 px-4 py-5 md:px-7 md:py-6">
          {children}
        </main>
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

type NavigationItem = (typeof workspace)[number];
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
