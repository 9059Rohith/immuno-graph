import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

import { JudgeModeProvider } from '@/features/judge-mode';

export function renderApp(ui: ReactNode, initialEntries = ['/']) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries}>
          <JudgeModeProvider>{ui}</JudgeModeProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  };
}
