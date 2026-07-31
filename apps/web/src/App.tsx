import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ThemePreference } from './stores/ui';
import { ArtifactViewer } from './features/artifacts/ArtifactViewer';
import { ChatPane } from './features/chat/ChatPane';
import { SessionSidebar } from './features/sessions/SessionSidebar';
import { useSessions } from './hooks/useSessions';
import { useUiStore } from './stores/ui';
import { IconMenu, IconPanel, IconSun } from './components/Icons';
import { PRODUCT_NAME } from './lib/brand';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AppShell() {
  const { sessions, isLoading } = useSessions(true);
  const selectedSessionId = useUiStore((s) => s.selectedSessionId);
  const setSelectedSessionId = useUiStore((s) => s.setSelectedSessionId);
  const artifactPanelOpen = useUiStore((s) => s.artifactPanelOpen);
  const setArtifactPanelOpen = useUiStore((s) => s.setArtifactPanelOpen);
  const artifactFullscreen = useUiStore((s) => s.artifactFullscreen);
  const setArtifactFullscreen = useUiStore((s) => s.setArtifactFullscreen);
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useUiStore((s) => s.setSidebarCollapsed);
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (sessions.length === 0) {
      if (selectedSessionId) setSelectedSessionId(null);
      return;
    }
    const stillExists = selectedSessionId
      ? sessions.some((s) => s.id === selectedSessionId)
      : false;
    if (!stillExists) {
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

  // Escape exits artifact fullscreen
  useEffect(() => {
    if (!artifactFullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setArtifactFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [artifactFullscreen, setArtifactFullscreen]);

  const cycleTheme = () => {
    const order: ThemePreference[] = ['system', 'light', 'dark'];
    const next = order[(order.indexOf(theme) + 1) % order.length];
    setTheme(next);
  };

  // True fullscreen artifact — hides chat, sidebar, and composer entirely
  if (artifactPanelOpen && artifactFullscreen) {
    return (
      <div className="app-shell">
        <ArtifactViewer />
      </div>
    );
  }

  return (
    <div className="app-shell flex flex-col">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-surface/95 px-3 lg:hidden">
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
          {PRODUCT_NAME}
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
        className={`workspace-grid min-h-0 flex-1 ${
          sidebarCollapsed ? 'sidebar-collapsed' : ''
        } ${artifactPanelOpen ? '' : 'artifact-hidden'}`}
      >
        <div
          className={`${
            sidebarOpen
              ? 'fixed inset-0 z-40 flex lg:static lg:z-auto'
              : 'hidden lg:flex'
          } min-h-0 overflow-hidden`}
        >
          {sidebarOpen && (
            <button
              type="button"
              className="absolute inset-0 bg-foreground/30 lg:hidden"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close sessions overlay"
            />
          )}
          <div className="relative z-10 h-full min-h-0 w-72 max-w-[88vw] overflow-hidden lg:w-full lg:max-w-none">
            <SessionSidebar
              collapsed={sidebarCollapsed}
              onCollapseChange={setSidebarCollapsed}
              onNavigate={() => setSidebarOpen(false)}
              theme={theme}
              onCycleTheme={cycleTheme}
            />
          </div>
        </div>

        <div className="min-h-0 min-w-0 overflow-hidden">
          <ChatPane onOpenSidebar={() => setSidebarOpen(true)} />
        </div>

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
          <div className="relative z-10 ml-auto h-full min-h-0 w-full max-w-3xl overflow-hidden lg:max-w-none">
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
