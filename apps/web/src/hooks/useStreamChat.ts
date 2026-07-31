import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { isMockMode, streamMessage } from '../lib/api';
import { consumeStream } from '../lib/stream';
import { appendMockMessage, registerMockArtifact } from '../lib/mock';
import { messagesKey } from './useMessages';
import type {
  ChatMode,
  Message,
  Source,
  StreamSource,
} from '../types/api';
import { useUiStore } from '../stores/ui';

interface SendOptions {
  sessionId: string;
  content: string;
  mode: ChatMode;
  provider: string;
  model: string;
}

function streamSourceToSource(s: StreamSource, rank: number): Source {
  return {
    citation_label: s.id,
    rank,
    guest: s.guest,
    episode: s.episode,
    excerpt: s.excerpt,
    url: s.url,
  };
}

export function useStreamChat() {
  const abortRef = useRef<AbortController | null>(null);
  const activeAssistantIdRef = useRef<string | null>(null);
  const tokenBufferRef = useRef('');
  const frameRef = useRef<number | null>(null);
  const queryClient = useQueryClient();
  const {
    setIsStreaming,
    setStatusLabel,
    setActiveSources,
    openArtifact,
    setSourcePanelOpen,
  } = useUiStore();

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    if (frameRef.current != null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    tokenBufferRef.current = '';
    setIsStreaming(false);
    setStatusLabel(null);
  }, [setIsStreaming, setStatusLabel]);

  const send = useCallback(
    async ({ sessionId, content, mode, provider, model }: SendOptions) => {
      // Close overlays that can cover the composer on retry
      setSourcePanelOpen(false);
      stop();

      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content,
        status: 'completed',
        skill: null,
        provider,
        model,
        latency_ms: null,
        error_code: null,
        created_at: new Date().toISOString(),
        sources: [],
      };

      const assistantId = crypto.randomUUID();
      activeAssistantIdRef.current = assistantId;
      const assistantMessage: Message = {
        id: assistantId,
        role: 'assistant',
        content: '',
        status: 'streaming',
        skill: null,
        provider,
        model,
        latency_ms: null,
        error_code: null,
        created_at: new Date().toISOString(),
        sources: [],
      };

      queryClient.setQueryData<Message[]>(messagesKey(sessionId), (prev) => [
        ...(prev ?? []),
        userMessage,
        assistantMessage,
      ]);

      // Keep composer focused / in view after retry
      requestAnimationFrame(() => {
        document.getElementById('composer-input')?.focus({ preventScroll: true });
        document.getElementById('composer-dock')?.scrollIntoView({
          block: 'end',
          behavior: 'smooth',
        });
      });

      if (isMockMode()) {
        setIsStreaming(true);
        setStatusLabel("Searching Lenny's transcripts");
        await new Promise((r) => setTimeout(r, 600));
        const mockSources: Source[] = [
          {
            citation_label: 'S1',
            rank: 1,
            guest: 'Sample Guest',
            episode: 'Mock Episode',
            excerpt: 'Retention is the signal for product-market fit.',
            url: null,
          },
        ];
        setActiveSources(mockSources);
        const artifactId = crypto.randomUUID();
        const isEssay = mode === 'ship30_essay';
        const isArtifact = mode === 'artifact';
        const text = isEssay
          ? '# The PMF Signal Hiding in Retention\n\nMost teams look for product-market fit in the loud places: launch spikes, social proof, and big sales calls.\n\nLenny\'s guests point to a quieter signal: users keep coming back without being pushed. Retention is the market continuing the conversation. [S1]\n\nWhen organic growth starts compounding on top of that retention, the product is no longer being dragged uphill. It has found pull.'
          : isArtifact
            ? 'I created an HTML growth strategy dashboard artifact with a focused acquisition, activation, retention, and referral view. [S1]'
            : 'Lenny\'s guests often describe product-market fit as a retention and pull problem. The strongest pattern is that retained users become the signal before revenue or acquisition volume looks impressive. [S1]';
        for (const word of text.split(' ')) {
          await new Promise((r) => setTimeout(r, 40));
          queryClient.setQueryData<Message[]>(
            messagesKey(sessionId),
            (prev) =>
              (prev ?? []).map((m) =>
                m.id === assistantId
                  ? { ...m, content: m.content + (m.content ? ' ' : '') + word }
                  : m,
              ),
          );
        }
        if (isEssay || isArtifact) {
          registerMockArtifact({
            id: artifactId,
            session_id: sessionId,
            message_id: assistantId,
            type: isArtifact ? 'html' : 'markdown',
            title: isArtifact ? 'Growth Strategy Dashboard' : 'Ship30 PMF Essay',
            language: isArtifact ? 'html' : 'markdown',
            content: isArtifact
              ? '<main style="font-family: system-ui; max-width: 960px; margin: 0 auto; padding: 32px;"><h1>Growth Strategy Dashboard</h1><section style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px;"><article style="border:1px solid #d6d3ca; border-radius:8px; padding:16px;"><h2>Acquire</h2><p>Prioritize channels where user pull is already visible.</p></article><article style="border:1px solid #d6d3ca; border-radius:8px; padding:16px;"><h2>Activate</h2><p>Shorten time to first retained behavior.</p></article><article style="border:1px solid #d6d3ca; border-radius:8px; padding:16px;"><h2>Retain</h2><p>Measure repeated value, not vanity engagement.</p></article><article style="border:1px solid #d6d3ca; border-radius:8px; padding:16px;"><h2>Refer</h2><p>Turn satisfied teams into reliable word of mouth.</p></article></section></main>'
              : text,
            created_at: new Date().toISOString(),
          });
          openArtifact(artifactId);
        }
        queryClient.setQueryData<Message[]>(messagesKey(sessionId), (prev) =>
          (prev ?? []).map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  status: 'completed',
                  skill: isEssay
                    ? 'ship30_essay'
                    : isArtifact
                      ? 'artifact_generator'
                      : 'transcript_qa',
                  latency_ms: 1200,
                  sources: mockSources,
                }
              : m,
          ),
        );
        appendMockMessage(sessionId, userMessage);
        appendMockMessage(sessionId, {
          ...assistantMessage,
          content: text,
          status: 'completed',
          skill: 'transcript_qa',
          latency_ms: 1200,
          sources: mockSources,
        });
        void queryClient.invalidateQueries({ queryKey: ['sessions'] });
        setIsStreaming(false);
        setStatusLabel(null);
        activeAssistantIdRef.current = null;
        return;
      }

      const controller = new AbortController();
      abortRef.current = controller;
      setIsStreaming(true);
      setStatusLabel(null);

      let resolvedAssistantId: string = assistantId;

      const flushTokens = (messageId: string) => {
        const buffered = tokenBufferRef.current;
        if (!buffered) return;
        tokenBufferRef.current = '';
        queryClient.setQueryData<Message[]>(
          messagesKey(sessionId),
          (prev) =>
            (prev ?? []).map((m) =>
              m.id === messageId
                ? { ...m, content: m.content + buffered }
                : m,
            ),
        );
      };

      const scheduleTokenFlush = (messageId: string) => {
        if (frameRef.current != null) return;
        frameRef.current = requestAnimationFrame(() => {
          frameRef.current = null;
          flushTokens(messageId);
        });
      };

      try {
        const response = await streamMessage(
          sessionId,
          { content, mode, provider, model },
          controller.signal,
        );

        let sources: Source[] = [];

        await consumeStream(response, (event) => {
          switch (event.event) {
            case 'run_started':
              resolvedAssistantId = event.message_id;
              activeAssistantIdRef.current = event.message_id;
              queryClient.setQueryData<Message[]>(
                messagesKey(sessionId),
                (prev) =>
                  (prev ?? []).map((m) =>
                    m.id === assistantId
                      ? { ...m, id: event.message_id }
                      : m,
                  ),
              );
              break;
            case 'status':
              setStatusLabel(event.label);
              break;
            case 'sources':
              flushTokens(resolvedAssistantId);
              sources = event.sources.map((s, i) =>
                streamSourceToSource(s, i + 1),
              );
              setActiveSources(event.sources);
              queryClient.setQueryData<Message[]>(
                messagesKey(sessionId),
                (prev) =>
                  (prev ?? []).map((m) =>
                    m.id === resolvedAssistantId
                      ? { ...m, sources }
                      : m,
                  ),
              );
              break;
            case 'token':
              tokenBufferRef.current += event.text;
              scheduleTokenFlush(resolvedAssistantId);
              break;
            case 'content_replace':
              flushTokens(resolvedAssistantId);
              queryClient.setQueryData<Message[]>(
                messagesKey(sessionId),
                (prev) =>
                  (prev ?? []).map((m) =>
                    m.id === resolvedAssistantId
                      ? { ...m, content: event.text }
                      : m,
                  ),
              );
              break;
            case 'artifact':
              flushTokens(resolvedAssistantId);
              openArtifact(event.artifact_id);
              break;
            case 'completed':
              flushTokens(resolvedAssistantId);
              queryClient.setQueryData<Message[]>(
                messagesKey(sessionId),
                (prev) =>
                  (prev ?? []).map((m) =>
                    m.id === resolvedAssistantId
                      ? {
                          ...m,
                          status: 'completed',
                          skill: event.skill,
                          latency_ms: event.latency_ms,
                          sources,
                        }
                      : m,
                  ),
              );
              break;
            case 'error':
              flushTokens(resolvedAssistantId);
              queryClient.setQueryData<Message[]>(
                messagesKey(sessionId),
                (prev) =>
                  (prev ?? []).map((m) =>
                    m.id === resolvedAssistantId
                      ? {
                          ...m,
                          status: 'failed',
                          content: m.content || event.message,
                          error_code: event.code,
                        }
                      : m,
                  ),
              );
              break;
          }
        });

        // Soft refresh — keep optimistic UI; don't blank the thread
        void queryClient.invalidateQueries({
          queryKey: messagesKey(sessionId),
          refetchType: 'active',
        });
        void queryClient.invalidateQueries({ queryKey: ['sessions'] });
      } catch (err) {
        const targetId = activeAssistantIdRef.current ?? assistantId;
        if (controller.signal.aborted) {
          queryClient.setQueryData<Message[]>(messagesKey(sessionId), (prev) =>
            (prev ?? []).map((m) =>
              m.id === targetId || m.id === assistantId
                ? {
                    ...m,
                    status: 'cancelled' as const,
                    content:
                      m.content ||
                      'Generation stopped. You can retry or edit your question.',
                  }
                : m,
            ),
          );
        } else {
          const message =
            err instanceof Error ? err.message : 'Stream failed';
          queryClient.setQueryData<Message[]>(messagesKey(sessionId), (prev) =>
            (prev ?? []).map((m) =>
              m.id === targetId || m.id === assistantId
                ? {
                    ...m,
                    status: 'failed',
                    content: m.content || message,
                    error_code: 'STREAM_ERROR',
                  }
                : m,
            ),
          );
        }
      } finally {
        if (frameRef.current != null) {
          cancelAnimationFrame(frameRef.current);
          frameRef.current = null;
        }
        flushTokens(activeAssistantIdRef.current ?? assistantId);
        abortRef.current = null;
        activeAssistantIdRef.current = null;
        setIsStreaming(false);
        setStatusLabel(null);
        requestAnimationFrame(() => {
          document.getElementById('composer-input')?.focus({ preventScroll: true });
        });
      }
    },
    [
      openArtifact,
      queryClient,
      setActiveSources,
      setIsStreaming,
      setSourcePanelOpen,
      setStatusLabel,
      stop,
    ],
  );

  return { send, stop };
}
