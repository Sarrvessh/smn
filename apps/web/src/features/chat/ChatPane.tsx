import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { ChatMode, Source, StreamSource } from '../../types/api';
import { useKnowledgeStatus } from '../../hooks/useKnowledgeStatus';
import { useMessages } from '../../hooks/useMessages';
import { useProviders } from '../../hooks/useProviders';
import { useSessions } from '../../hooks/useSessions';
import { useStreamChat } from '../../hooks/useStreamChat';
import { useUiStore } from '../../stores/ui';
import { IconMenu, IconPanel, IconSources } from '../../components/Icons';
import { ProviderSelectors } from '../providers/ProviderSelectors';
import { isEmbeddingModel, providerState } from '../providers/providerUtils';
import { SourcePanel } from '../sources/SourcePanel';
import { Composer } from './Composer';
import { MessageList } from './MessageList';

interface ChatPaneProps {
  onOpenSidebar: () => void;
}

function getSourceLabel(source: Source | StreamSource) {
  return 'citation_label' in source ? source.citation_label : source.id;
}

export function ChatPane({ onOpenSidebar }: ChatPaneProps) {
  const selectedSessionId = useUiStore((s) => s.selectedSessionId);
  const isStreaming = useUiStore((s) => s.isStreaming);
  const statusLabel = useUiStore((s) => s.statusLabel);
  const activeSources = useUiStore((s) => s.activeSources);
  const setActiveSources = useUiStore((s) => s.setActiveSources);
  const artifactPanelOpen = useUiStore((s) => s.artifactPanelOpen);
  const setArtifactPanelOpen = useUiStore((s) => s.setArtifactPanelOpen);
  const sourcePanelOpen = useUiStore((s) => s.sourcePanelOpen);
  const setSourcePanelOpen = useUiStore((s) => s.setSourcePanelOpen);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const { sessions, updateSession, createSession, isCreating } = useSessions();
  const { messages, isLoading, error } = useMessages(selectedSessionId);
  const { data: providerData } = useProviders();
  const { data: knowledge } = useKnowledgeStatus();
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

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages, isStreaming, statusLabel]);

  const activeProvider = providerData?.providers.find(
    (p) => p.id === session?.provider,
  );
  const providerStatus = providerState(activeProvider);

  const blockedReason = useMemo(() => {
    // Only hard-block on real provider / knowledge failures — never on selection races.
    const provider = activeProvider
      ?? providerData?.providers.find((p) => p.id === 'ollama')
      ?? null;
    if (provider && !provider.configured) {
      return `${provider.id} is not configured. Switch to Ollama or add credentials.`;
    }
    if (provider && !provider.healthy) {
      return `${provider.id} is unavailable. Start Ollama or switch providers.`;
    }
    const chatModels = (provider?.models ?? []).filter((m) => !isEmbeddingModel(m));
    if (provider && chatModels.length === 0) {
      return 'No chat model available. Pull a model (e.g. ollama pull qwen2.5:7b).';
    }
    if (knowledge && !knowledge.ready) {
      return 'Knowledge base is empty. Run ingestion before grounded Q&A.';
    }
    return null;
  }, [activeProvider, knowledge, providerData?.providers]);

  // Auto-heal: if selection points at a missing session, pick the newest one
  useEffect(() => {
    if (sessions.length === 0) return;
    if (session) return;
    if (selectedSessionId && sessions.some((s) => s.id === selectedSessionId)) {
      return;
    }
    useUiStore.getState().setSelectedSessionId(sessions[0].id);
  }, [session, sessions, selectedSessionId]);

  const handleProviderChange = useCallback(
    (provider: string, model: string) => {
      if (!selectedSessionId) return;
      void updateSession(selectedSessionId, { provider, model });
    },
    [selectedSessionId, updateSession],
  );

  const handleSend = useCallback(
    async (content: string, mode: ChatMode) => {
      let targetSession = session ?? sessions[0] ?? null;
      if (targetSession && !session) {
        useUiStore.getState().setSelectedSessionId(targetSession.id);
      }
      if (!targetSession) {
        const ollama = providerData?.providers.find((p) => p.id === 'ollama');
        const model =
          ollama && ollama.healthy
            ? (ollama.models.find((m) => !isEmbeddingModel(m)) ?? 'qwen2.5:7b')
            : 'qwen2.5:7b';
        targetSession = await createSession({
          title: content.slice(0, 52) || 'New chat',
          provider: 'ollama',
          model,
        });
      }
      await send({
        sessionId: targetSession.id,
        content,
        mode,
        provider: targetSession.provider || 'ollama',
        model: targetSession.model || 'qwen2.5:7b',
      });
    },
    [createSession, providerData?.providers, send, session, sessions],
  );

  const handleOpenSources = (sources?: Source[] | StreamSource[]) => {
    if (sources && sources.length > 0) {
      setActiveSources(sources);
    }
    setSourcePanelOpen(true);
  };

  const showBlockingLoad = isLoading && messages.length === 0;

  return (
    <main className="relative flex h-full min-w-0 flex-1 flex-col bg-background">
      <header className="z-10 flex min-h-12 items-center gap-2 border-b border-border bg-surface/90 px-3 backdrop-blur-md lg:px-5">
        <button
          type="button"
          className="icon-button lg:hidden"
          onClick={onOpenSidebar}
          aria-label="Open sessions"
          title="Sessions"
        >
          <IconMenu />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[13px] font-semibold tracking-tight">
            {session?.title ?? (sessions.length === 0 ? 'New conversation' : 'Conversation')}
          </h2>
          <div className="mt-0.5 flex min-h-4 items-center gap-2 text-[11px] text-muted-foreground">
            {statusLabel ? (
              <span className="inline-flex items-center gap-1.5" aria-live="polite">
                <span className="status-dot warning animate-pulse" />
                {statusLabel}
              </span>
            ) : (
              <span className="hidden sm:inline">
                {knowledge?.ready
                  ? `${knowledge.episodes} episodes indexed`
                  : 'Checking knowledge base'}
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <ProviderSelectors session={session} onChange={handleProviderChange} />
          <button
            type="button"
            className="icon-button hidden sm:inline-flex"
            onClick={() => handleOpenSources()}
            aria-label="Open sources"
            title="Sources"
            disabled={displaySources.length === 0}
          >
            <IconSources />
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={() => setArtifactPanelOpen(!artifactPanelOpen)}
            aria-label={artifactPanelOpen ? 'Hide artifact workspace' : 'Show artifact workspace'}
            title={artifactPanelOpen ? 'Hide artifacts' : 'Show artifacts'}
          >
            <IconPanel />
          </button>
        </div>
      </header>

      {blockedReason && (
        <div
          className="border-b border-warning/25 bg-warning/10 px-4 py-2 text-[12px] text-foreground"
          role="status"
        >
          <span className={`status-dot ${providerStatus.className} mr-2`} />
          {blockedReason}
        </div>
      )}

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {showBlockingLoad ? (
          <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-8">
            <div className="skeleton h-20 w-4/5" />
            <div className="skeleton ml-auto h-14 w-2/3" />
            <div className="skeleton h-28 w-full" />
          </div>
        ) : error && messages.length === 0 ? (
          <div className="mx-auto flex h-full max-w-xl flex-col items-center justify-center px-6 text-center">
            <div className="rounded-xl border border-border bg-surface px-6 py-8">
              <h2 className="text-[15px] font-semibold tracking-tight">
                Messages could not load
              </h2>
              <p className="mt-2 text-[13px] text-muted-foreground">
                Refresh or select the chat again. Your composer stays available.
              </p>
            </div>
          </div>
        ) : (
          <div ref={scrollRef} className="h-full overflow-y-auto scrollbar-stable">
            <MessageList
              messages={messages}
              isStreaming={isStreaming}
              onOpenSources={handleOpenSources}
              onPromptClick={(prompt) => void handleSend(prompt, 'auto')}
              onRetry={(content) => void handleSend(content, 'auto')}
            />
          </div>
        )}

        <SourcePanel
          sources={displaySources}
          open={sourcePanelOpen}
          onClose={() => setSourcePanelOpen(false)}
          highlightedLabel={
            displaySources.length > 0 ? getSourceLabel(displaySources[0]) : null
          }
        />
      </div>

      <Composer
        sendBlocked={isCreating || !!blockedReason}
        blockedReason={
          isCreating ? 'Creating chat…' : blockedReason
        }
        isStreaming={isStreaming}
        onSend={handleSend}
        onStop={stop}
      />
    </main>
  );
}
