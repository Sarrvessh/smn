import { create } from 'zustand';
import type { ChatMode, Source, StreamSource } from '../types/api';

interface UiState {
  selectedSessionId: string | null;
  artifactPanelOpen: boolean;
  selectedArtifactId: string | null;
  mode: ChatMode;
  activeSources: Source[] | StreamSource[];
  highlightedCitation: string | null;
  isStreaming: boolean;
  statusLabel: string | null;

  setSelectedSessionId: (id: string | null) => void;
  setArtifactPanelOpen: (open: boolean) => void;
  setSelectedArtifactId: (id: string | null) => void;
  openArtifact: (id: string) => void;
  setMode: (mode: ChatMode) => void;
  setActiveSources: (sources: Source[] | StreamSource[]) => void;
  setHighlightedCitation: (label: string | null) => void;
  setIsStreaming: (streaming: boolean) => void;
  setStatusLabel: (label: string | null) => void;
}

export const useUiStore = create<UiState>((set) => ({
  selectedSessionId: null,
  artifactPanelOpen: false,
  selectedArtifactId: null,
  mode: 'auto',
  activeSources: [],
  highlightedCitation: null,
  isStreaming: false,
  statusLabel: null,

  setSelectedSessionId: (id) => set({ selectedSessionId: id }),
  setArtifactPanelOpen: (open) => set({ artifactPanelOpen: open }),
  setSelectedArtifactId: (id) => set({ selectedArtifactId: id }),
  openArtifact: (id) =>
    set({ selectedArtifactId: id, artifactPanelOpen: true }),
  setMode: (mode) => set({ mode }),
  setActiveSources: (sources) => set({ activeSources: sources }),
  setHighlightedCitation: (label) => set({ highlightedCitation: label }),
  setIsStreaming: (streaming) => set({ isStreaming: streaming }),
  setStatusLabel: (label) => set({ statusLabel: label }),
}));
