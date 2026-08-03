import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

import { App } from './app';
import { TooltipProvider } from './components/ui/tooltip';
import { Toaster } from './components/ui/sonner';
import { createAppQueryClient } from './lib/query-client';
import './styles.css';
import { AuthProvider } from './features/auth';
import { JudgeModeProvider } from './features/judge-mode';

const rootElement = document.getElementById('root');

if (rootElement === null) {
  throw new Error('Root element was not found.');
}

const queryClient = createAppQueryClient();

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <JudgeModeProvider>
            <TooltipProvider>
              <App />
              <Toaster />
            </TooltipProvider>
          </JudgeModeProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
