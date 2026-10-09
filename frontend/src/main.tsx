import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'

import 'leaflet/dist/leaflet.css'

import App from '@/App'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { ToastProvider } from '@/components/ui/Toast'

import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Keep the browser's Evidence UI responsive. TanStack Query will
      // retry a failed source once before it falls back to the caches, which
      // is exactly what the admin page needs when a single request trips a
      // 5xx. Batch polling and the 401 token-refresh flow live in api/client.ts
      // and stay separately retryable.
      retry: 1,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30_000),
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ToastProvider>
          {/* Top-level safety net (Phase 34, Step 88) — a crash anywhere still
              renders a recoverable fallback instead of a blank page. */}
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
