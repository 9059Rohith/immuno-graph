import { QueryClient } from '@tanstack/react-query';

import { ApiError } from './api-client';

export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) =>
          failureCount < 2 && error instanceof ApiError && error.retryable,
        staleTime: 30_000,
      },
      mutations: { retry: false },
    },
  });
}
