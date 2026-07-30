import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { isMockMode, streamMessage } from '../lib/api';
import { consumeStream } from '../lib/stream';
import { appendMockMessage } from '../lib/mock';
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
  const queryClient = useQueryClient();
  const {
    setIsStreaming,
    setStatusLabel,
    setActiveSources,
    openArtifact,
  } = useUiStore();

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
    setStatusLabel(null);
  }, [setIsStreaming, setStatusLabel]);

  const send = useCallback(
    async ({ sessionId, content, mode, provider, model }: SendOptions) => {
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

      if (isMockMode()) {
        setIsStreaming(true);
        setStatusLabel('Searching Lenny\'s transcripts');
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
        const text =
          'In mock mode, Lenny\'s guests emphasize retention and organic growth as PMF signals. [S1]';
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
        queryClient.setQueryData<Message[]>(messagesKey(sessionId), (prev) =>
          (prev ?? []).map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  status: 'completed',
                  skill: 'transcript_qa',
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
        setIsStreaming(false);
        setStatusLabel(null);
        return;
      }

      const controller = new AbortController();
      abortRef.current = controller;
      setIsStreaming(true);
      setStatusLabel(null);

      try {
        const response = await streamMessage(
          sessionId,
          { content, mode, provider, model },
          controller.signal,
        );

        let resolvedAssistantId: string = assistantId;
        let sources: Source[] = [];

        await consumeStream(response, (event) => {
          switch (event.event) {
            case 'run_started':
              resolvedAssistantId = event.message_id;
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
              queryClient.setQueryData<Message[]>(
                messagesKey(sessionId),
                (prev) =>
                  (prev ?? []).map((m) =>
                    m.id === resolvedAssistantId
                      ? { ...m, content: m.content + event.text }
                      : m,
                  ),
              );
              break;
            case 'content_replace':
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
              openArtifact(event.artifact_id);
              break;
            case 'completed':
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

        void queryClient.invalidateQueries({ queryKey: messagesKey(sessionId) });
      } catch (err) {
        if (controller.signal.aborted) {
          queryClient.setQueryData<Message[]>(messagesKey(sessionId), (prev) =>
            (prev ?? []).map((m) =>
              m.id === assistantId
                ? { ...m, status: 'cancelled' as const }
                : m,
            ),
          );
        } else {
          const message =
            err instanceof Error ? err.message : 'Stream failed';
          queryClient.setQueryData<Message[]>(messagesKey(sessionId), (prev) =>
            (prev ?? []).map((m) =>
              m.id === assistantId
                ? { ...m, status: 'failed', content: message, error_code: 'STREAM_ERROR' }
                : m,
            ),
          );
        }
      } finally {
        abortRef.current = null;
        setIsStreaming(false);
        setStatusLabel(null);
      }
    },
    [
      openArtifact,
      queryClient,
      setActiveSources,
      setIsStreaming,
      setStatusLabel,
      stop,
    ],
  );

  return { send, stop };
}
