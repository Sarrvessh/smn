import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ArtifactViewer } from './features/artifacts/ArtifactViewer';
import { ChatPane } from './features/chat/ChatPane';
import { SessionSidebar } from './features/sessions/SessionSidebar';
import { useAnonymousUser } from './hooks/useAnonymousUser';
import { useSessions } from './hooks/useSessions';
import { useUiStore } from './stores/ui';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AppShell() {
  const { isReady, error: userError } = useAnonymousUser();
  const { sessions, isLoading } = useSessions(isReady);
  const selectedSessionId = useUiStore((s) => s.selectedSessionId);
  const setSelectedSessionId = useUiStore((s) => s.setSelectedSessionId);
  const artifactPanelOpen = useUiStore((s) => s.artifactPanelOpen);
  const setArtifactPanelOpen = useUiStore((s) => s.setArtifactPanelOpen);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!selectedSessionId && sessions.length > 0) {
      setSelectedSessionId(sessions[0].id);
    }
  }, [sessions, selectedSessionId, setSelectedSessionId]);

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-ink-500">Initializing...</p>
      </div>
    );
  }

  if (userError) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="panel max-w-md rounded-xl p-6 text-center">
          <h1 className="text-lg font-semibold text-ink-900">
            Lenny Growth Assistant
          </h1>
          <p className="mt-2 text-sm text-red-600">{userError}</p>
          <p className="mt-2 text-xs text-ink-500">
            Ensure the API is running at localhost:8000
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <div className="flex items-center justify-between border-b border-ink-200/60 bg-white/60 px-4 py-2 lg:hidden">
        <button
          type="button"
          className="btn-secondary text-xs"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label="Toggle sessions"
        >
          Sessions
        </button>
        <span className="text-sm font-bold text-ink-900">Lenny Growth Assistant</span>
        <button
          type="button"
          className="btn-secondary text-xs"
          onClick={() => setArtifactPanelOpen(!artifactPanelOpen)}
          aria-label="Toggle artifacts"
        >
          Artifacts
        </button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[16rem_1fr_20rem]">
        <div
          className={`${
            sidebarOpen ? 'fixed inset-0 z-40 flex lg:static lg:z-auto' : 'hidden lg:flex'
          }`}
        >
          {sidebarOpen && (
            <button
              type="button"
              className="absolute inset-0 bg-ink-900/30 lg:hidden"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close sessions overlay"
            />
          )}
          <div className="relative z-10 h-full w-64 max-w-[85vw] lg:w-full lg:max-w-none">
            <SessionSidebar />
          </div>
        </div>

        <ChatPane />

        <div
          className={`${
            artifactPanelOpen
              ? 'fixed inset-0 z-40 flex lg:static lg:z-auto'
              : 'hidden lg:flex'
          }`}
        >
          {artifactPanelOpen && (
            <button
              type="button"
              className="absolute inset-0 bg-ink-900/30 lg:hidden"
              onClick={() => setArtifactPanelOpen(false)}
              aria-label="Close artifacts overlay"
            />
          )}
          <div className="relative z-10 ml-auto h-full w-full max-w-lg lg:max-w-none">
            <ArtifactViewer />
          </div>
        </div>
      </div>

      {isLoading && sessions.length === 0 && (
        <p className="sr-only">Loading sessions</p>
      )}
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppShell />
    </QueryClientProvider>
  );
}
