export type WorkspaceKind = 'application' | 'package';

export type WorkspaceDescriptor = Readonly<{
  kind: WorkspaceKind;
  name: string;
  responsibility: string;
}>;

export const WORKSPACE_NAME = 'ImmunoGraph' as const;
