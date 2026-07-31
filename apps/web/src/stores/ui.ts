import { create } from 'zustand';
import type { ChatMode, Source, StreamSource } from '../types/api';

export type ThemePreference = 'light' | 'dark' | 'system';

interface UiState {
  selectedSessionId: string | null;
  artifactPanelOpen: boolean;
  artifactFullscreen: boolean;
  sidebarCollapsed: boolean;
  sourcePanelOpen: boolean;
  selectedArtifactId: string | null;
  mode: ChatMode;
  theme: ThemePreference;
  activeSources: Source[] | StreamSource[];
  highlightedCitation: string | null;
  isStreaming: boolean;
  statusLabel: string | null;
  pinnedSessionIds: string[];

  setSelectedSessionId: (id: string | null) => void;
  setArtifactPanelOpen: (open: boolean) => void;
  setArtifactFullscreen: (fullscreen: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSourcePanelOpen: (open: boolean) => void;
  setSelectedArtifactId: (id: string | null) => void;
  openArtifact: (id: string) => void;
  setMode: (mode: ChatMode) => void;
  setTheme: (theme: ThemePreference) => void;
  setActiveSources: (sources: Source[] | StreamSource[]) => void;
  setHighlightedCitation: (label: string | null) => void;
  setIsStreaming: (streaming: boolean) => void;
  setStatusLabel: (label: string | null) => void;
  togglePinnedSession: (id: string) => void;
}

const THEME_KEY = 'lenny_theme';
const PINNED_KEY = 'lenny_pinned_sessions';

function getInitialTheme(): ThemePreference {
  if (typeof window === 'undefined') return 'system';
  const stored = window.localStorage.getItem(THEME_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored;
  }
  return 'system';
}

function getInitialPinned(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(PINNED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === 'string')
      : [];
  } catch {
    return [];
  }
}

function persistPinned(ids: string[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PINNED_KEY, JSON.stringify(ids));
}

export const useUiStore = create<UiState>((set) => ({
  selectedSessionId: null,
  artifactPanelOpen: false,
  artifactFullscreen: false,
  sidebarCollapsed: false,
  sourcePanelOpen: false,
  selectedArtifactId: null,
  mode: 'auto',
  theme: getInitialTheme(),
  activeSources: [],
  highlightedCitation: null,
  isStreaming: false,
  statusLabel: null,
  pinnedSessionIds: getInitialPinned(),

  setSelectedSessionId: (id) =>
    set({ selectedSessionId: id, activeSources: [], highlightedCitation: null }),
  setArtifactPanelOpen: (open) => set({ artifactPanelOpen: open }),
  setArtifactFullscreen: (fullscreen) => set({ artifactFullscreen: fullscreen }),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setSourcePanelOpen: (open) => set({ sourcePanelOpen: open }),
  setSelectedArtifactId: (id) => set({ selectedArtifactId: id }),
  openArtifact: (id) =>
    set({ selectedArtifactId: id, artifactPanelOpen: true }),
  setMode: (mode) => set({ mode }),
  setTheme: (theme) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(THEME_KEY, theme);
    }
    set({ theme });
  },
  setActiveSources: (sources) => set({ activeSources: sources }),
  setHighlightedCitation: (label) => set({ highlightedCitation: label }),
  setIsStreaming: (streaming) => set({ isStreaming: streaming }),
  setStatusLabel: (label) => set({ statusLabel: label }),
  togglePinnedSession: (id) =>
    set((state) => {
      const exists = state.pinnedSessionIds.includes(id);
      const pinnedSessionIds = exists
        ? state.pinnedSessionIds.filter((x) => x !== id)
        : [id, ...state.pinnedSessionIds];
      persistPinned(pinnedSessionIds);
      return { pinnedSessionIds };
    }),
}));
