import { useCallback, useEffect, useMemo } from 'react';
import type { ChatMode } from '../../types/api';
import { useMessages } from '../../hooks/useMessages';
import { useSessions } from '../../hooks/useSessions';
import { useStreamChat } from '../../hooks/useStreamChat';
import { useUiStore } from '../../stores/ui';
import { ProviderSelectors } from '../providers/ProviderSelectors';
import { SourcePanel } from '../sources/SourcePanel';
import { Composer } from './Composer';
import { MessageList } from './MessageList';

export function ChatPane() {
  const selectedSessionId = useUiStore((s) => s.selectedSessionId);
  const isStreaming = useUiStore((s) => s.isStreaming);
  const statusLabel = useUiStore((s) => s.statusLabel);
  const activeSources = useUiStore((s) => s.activeSources);
  const setActiveSources = useUiStore((s) => s.setActiveSources);
  const artifactPanelOpen = useUiStore((s) => s.artifactPanelOpen);
  const setArtifactPanelOpen = useUiStore((s) => s.setArtifactPanelOpen);

  const { sessions, updateSession } = useSessions();
  const { messages, isLoading } = useMessages(selectedSessionId);
  const { send, stop } = useStreamChat();

  const session = useMemo(
    () => sessions.find((s) => s.id === selectedSessionId) ?? null,
    [sessions, selectedSessionId],
  );

  const displaySources = useMemo(() => {
    if (activeSources.length > 0) return activeSources;
    const lastWithSources = [...messages]
      .reverse()
      .find((m) => m.sources.length > 0);
    return lastWithSources?.sources ?? [];
  }, [activeSources, messages]);

  useEffect(() => {
    if (displaySources.length > 0 && activeSources.length === 0) {
      setActiveSources(displaySources);
    }
  }, [displaySources, activeSources.length, setActiveSources]);

  const handleProviderChange = useCallback(
    (provider: string, model: string) => {
      if (!selectedSessionId) return;
      void updateSession(selectedSessionId, { provider, model });
    },
    [selectedSessionId, updateSession],
  );

  const handleSend = (content: string, mode: ChatMode) => {
    if (!selectedSessionId || !session) return;
    void send({
      sessionId: selectedSessionId,
      content,
      mode,
      provider: session.provider,
      model: session.model,
    });
  };

  if (!selectedSessionId) {
    return (
      <main className="flex h-full flex-1 flex-col panel">
        <header className="border-b border-ink-200/60 px-4 py-3">
          <h2 className="text-sm font-semibold text-ink-800">Conversation</h2>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-sm text-ink-500">
            Select a session or start a new chat to begin.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-full min-w-0 flex-1 flex-col panel">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-200/60 px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-ink-800">
            {session?.title ?? 'Conversation'}
          </h2>
          {statusLabel && (
            <p className="text-xs text-accent animate-pulse">{statusLabel}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ProviderSelectors session={session} onChange={handleProviderChange} />
          <button
            type="button"
            className="btn-secondary text-xs lg:hidden"
            onClick={() => setArtifactPanelOpen(!artifactPanelOpen)}
            aria-label="Toggle artifact panel"
          >
            Artifacts
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {isLoading ? (
          <p className="p-4 text-sm text-ink-500">Loading messages...</p>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <MessageList messages={messages} isStreaming={isStreaming} />
          </div>
        )}
        <SourcePanel sources={displaySources} />
      </div>

      <Composer
        disabled={!session}
        isStreaming={isStreaming}
        onSend={handleSend}
        onStop={stop}
        showSuggestions={messages.length === 0}
      />
    </main>
  );
}
