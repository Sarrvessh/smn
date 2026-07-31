import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ThemePreference } from './stores/ui';
import { ArtifactViewer } from './features/artifacts/ArtifactViewer';
import { ChatPane } from './features/chat/ChatPane';
import { SessionSidebar } from './features/sessions/SessionSidebar';
import { useAnonymousUser } from './hooks/useAnonymousUser';
import { useSessions } from './hooks/useSessions';
import { useUiStore } from './stores/ui';
import { IconMenu, IconPanel, IconSun } from './components/Icons';

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
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useUiStore((s) => s.setSidebarCollapsed);
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!selectedSessionId && sessions.length > 0) {
      setSelectedSessionId(sessions[0].id);
    }
  }, [sessions, selectedSessionId, setSelectedSessionId]);

  useEffect(() => {
    const applyTheme = () => {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const dark = theme === 'dark' || (theme === 'system' && prefersDark);
      document.documentElement.classList.toggle('dark', dark);
      document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    };
    applyTheme();
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', applyTheme);
    return () => media.removeEventListener('change', applyTheme);
  }, [theme]);

  const cycleTheme = () => {
    const order: ThemePreference[] = ['system', 'light', 'dark'];
    const next = order[(order.indexOf(theme) + 1) % order.length];
    setTheme(next);
  };

  if (!isReady) {
    return (
      <div className="app-shell flex items-center justify-center px-6">
        <div className="w-full max-w-sm space-y-4" aria-live="polite">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-[11px] font-bold text-accent-foreground">
              LG
            </div>
            <div>
              <p className="text-[13px] font-semibold tracking-tight">
                Lenny Growth Assistant
              </p>
              <p className="text-[11px] text-muted-foreground">Preparing workspace</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="skeleton h-2.5 w-full" />
            <div className="skeleton h-2.5 w-4/5" />
          </div>
        </div>
      </div>
    );
  }

  if (userError) {
    return (
      <div className="app-shell flex items-center justify-center px-6">
        <div className="max-w-md rounded-2xl border border-border bg-surface px-6 py-8 text-center">
          <h1 className="text-[15px] font-semibold tracking-tight">
            Lenny Growth Assistant
          </h1>
          <p className="mt-2 text-[13px] text-destructive">{userError}</p>
          <p className="mt-2 text-[12px] text-muted-foreground">
            Ensure the API is running at localhost:8001
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="flex h-12 items-center justify-between border-b border-border bg-surface/95 px-3 lg:hidden">
        <button
          type="button"
          className="icon-button"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label="Toggle sessions"
          title="Sessions"
        >
          <IconMenu />
        </button>
        <span className="min-w-0 truncate text-[13px] font-semibold tracking-tight">
          Lenny Growth Assistant
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            className="icon-button"
            onClick={cycleTheme}
            aria-label={`Theme: ${theme}`}
            title={`Theme: ${theme}`}
          >
            <IconSun />
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={() => setArtifactPanelOpen(!artifactPanelOpen)}
            aria-label="Toggle artifacts"
            title="Artifacts"
          >
            <IconPanel />
          </button>
        </div>
      </div>

      <div
        className={`workspace-grid ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${
          artifactPanelOpen ? '' : 'artifact-hidden'
        }`}
      >
        <div
          className={`${
            sidebarOpen
              ? 'fixed inset-0 z-40 flex lg:static lg:z-auto'
              : 'hidden lg:flex'
          } min-h-0`}
        >
          {sidebarOpen && (
            <button
              type="button"
              className="absolute inset-0 bg-foreground/30 lg:hidden"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close sessions overlay"
            />
          )}
          <div className="relative z-10 h-full w-72 max-w-[88vw] lg:w-full lg:max-w-none">
            <SessionSidebar
              collapsed={sidebarCollapsed}
              onCollapseChange={setSidebarCollapsed}
              onNavigate={() => setSidebarOpen(false)}
              theme={theme}
              onCycleTheme={cycleTheme}
            />
          </div>
        </div>

        <ChatPane onOpenSidebar={() => setSidebarOpen(true)} />

        <div
          className={`${
            artifactPanelOpen
              ? 'fixed inset-0 z-40 flex lg:static lg:z-auto'
              : 'hidden'
          } min-h-0 overflow-hidden lg:flex`}
          aria-hidden={!artifactPanelOpen}
        >
          {artifactPanelOpen && (
            <button
              type="button"
              className="absolute inset-0 bg-foreground/30 lg:hidden"
              onClick={() => setArtifactPanelOpen(false)}
              aria-label="Close artifacts overlay"
            />
          )}
          <div className="relative z-10 ml-auto h-full w-full max-w-3xl lg:max-w-none">
            <ArtifactViewer />
          </div>
        </div>

        {!artifactPanelOpen && (
          <div className="hidden min-h-0 overflow-hidden lg:block" aria-hidden="true" />
        )}
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
