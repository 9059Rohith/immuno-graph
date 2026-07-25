import { projectListSchema } from '@immunograph/shared';
import { useQuery } from '@tanstack/react-query';

import { apiRequest } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

export function useProjects(cursor?: string) {
  const query = new URLSearchParams({ limit: '20' });
  if (cursor !== undefined) query.set('cursor', cursor);
  return useQuery({
    queryKey: queryKeys.projects(cursor),
    queryFn: () => apiRequest(`/projects?${query.toString()}`, projectListSchema),
  });
}
