import { useState } from 'react';
import type { Components } from 'react-markdown';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Message, Source, StreamSource } from '../../types/api';
import { SUGGESTED_PROMPTS } from '../../types/api';
import { useUiStore } from '../../stores/ui';
import {
  IconCopy,
  IconPanel,
  IconRetry,
  IconSources,
} from '../../components/Icons';

interface MessageListProps {
  messages: Message[];
  isStreaming: boolean;
  onOpenSources: (sources?: Source[] | StreamSource[]) => void;
  onPromptClick: (prompt: string) => void;
  onRetry: (content: string) => void;
}

function CitationMarkdown({
  content,
  onCitationClick,
}: {
  content: string;
  onCitationClick: (label: string) => void;
}) {
  const linked = content.replace(/\[(S\d+)\]/g, '[$1](#citation-$1)');

  const components: Components = {
    a: ({ href, children }) => {
      if (href?.startsWith('#citation-')) {
        const label = href.slice('#citation-'.length);
        return (
          <button
            type="button"
            className="citation-link"
            onClick={() => onCitationClick(label)}
            aria-label={`Open source ${label}`}
          >
            {label}
          </button>
        );
      }
      return (
        <a href={href} target="_blank" rel="noreferrer">
          {children}
        </a>
      );
    },
  };

  return (
    <div className="markdown-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {linked}
      </ReactMarkdown>
    </div>
  );
}

function copyText(text: string, onCopied: () => void) {
  void navigator.clipboard.writeText(text).then(onCopied).catch(() => undefined);
}

function EmptyConversation({ onPromptClick }: { onPromptClick: (prompt: string) => void }) {
  const intents = ['Find patterns', 'Compare advice', 'Write essay', 'Create artifact'];
  return (
    <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center px-4 py-12">
      <div className="mb-10 max-w-xl">
        <h2 className="text-[1.75rem] font-semibold leading-tight tracking-tight text-foreground sm:text-[2rem]">
          Ask better product growth questions
        </h2>
        <p className="mt-3 text-[15px] leading-7 text-muted-foreground">
          Ground answers in Lenny&apos;s Podcast transcripts, inspect sources, and turn insights into essays or artifacts beside the chat.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {SUGGESTED_PROMPTS.map((prompt, index) => (
          <button
            key={prompt}
            type="button"
            className="group rounded-xl border border-border bg-surface px-4 py-4 text-left transition hover:border-border-strong hover:bg-surface-hover"
            onClick={() => onPromptClick(prompt)}
          >
            <span className="text-[11px] font-medium text-muted-foreground">
              {intents[index]}
            </span>
            <span className="mt-1.5 block text-[13px] font-medium leading-6 text-foreground">
              {prompt}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageActions({
  message,
  previousUserContent,
  onOpenSources,
  onRetry,
}: {
  message: Message;
  previousUserContent: string | null;
  onOpenSources: (sources?: Source[]) => void;
  onRetry: (content: string) => void;
}) {
  const openArtifact = useUiStore((s) => s.openArtifact);
  const [copied, setCopied] = useState(false);
  const hasSources = message.sources.length > 0;
  const artifactId = message.artifact_id ?? null;
  const canRetry =
    message.role === 'assistant' &&
    !!previousUserContent &&
    (message.status === 'completed' ||
      message.status === 'failed' ||
      message.status === 'cancelled');

  return (
    <div className="mt-2 flex flex-wrap items-center gap-0.5">
      {artifactId && (
        <button
          type="button"
          className="btn-secondary gap-1"
          onClick={() => openArtifact(artifactId)}
        >
          <IconPanel className="h-3.5 w-3.5" />
          Open artifact
        </button>
      )}
      <div className="flex flex-wrap items-center gap-0.5 opacity-100 transition sm:opacity-0 sm:group-hover/message:opacity-100 sm:group-focus-within/message:opacity-100">
        <button
          type="button"
          className="btn-ghost gap-1"
          onClick={() =>
            copyText(message.content, () => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            })
          }
        >
          <IconCopy className="h-3.5 w-3.5" />
          {copied ? 'Copied' : 'Copy'}
        </button>
        {canRetry && (
          <button
            type="button"
            className="btn-ghost gap-1"
            onClick={() => onRetry(previousUserContent)}
          >
            <IconRetry className="h-3.5 w-3.5" />
            Retry
          </button>
        )}
        {hasSources && (
          <button
            type="button"
            className="btn-ghost gap-1"
            onClick={() => onOpenSources(message.sources)}
          >
            <IconSources className="h-3.5 w-3.5" />
            Sources ({message.sources.length})
          </button>
        )}
      </div>
    </div>
  );
}

export function MessageList({
  messages,
  isStreaming,
  onOpenSources,
  onPromptClick,
  onRetry,
}: MessageListProps) {
  const setHighlightedCitation = useUiStore((s) => s.setHighlightedCitation);
  const setActiveSources = useUiStore((s) => s.setActiveSources);
  const setSourcePanelOpen = useUiStore((s) => s.setSourcePanelOpen);

  const handleCitationClick = (label: string, message: Message) => {
    setHighlightedCitation(label);
    if (message.sources.length > 0) {
      setActiveSources(message.sources);
      setSourcePanelOpen(true);
      requestAnimationFrame(() => {
        document.getElementById(`source-${label}`)?.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth',
        });
      });
    }
  };

  if (messages.length === 0) {
    return <EmptyConversation onPromptClick={onPromptClick} />;
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col px-4 py-6 sm:px-6">
      {messages.map((message, idx) => {
        const isUser = message.role === 'user';
        const isLastAssistant =
          message.role === 'assistant' &&
          idx === messages.length - 1 &&
          isStreaming;
        const previousUserContent =
          message.role === 'assistant'
            ? [...messages.slice(0, idx)]
                .reverse()
                .find((m) => m.role === 'user')?.content ?? null
            : null;

        return (
          <article
            key={message.id}
            className={`group/message message-enter flex gap-3 py-5 ${
              isUser ? 'justify-end' : 'justify-start'
            }`}
          >
            {!isUser && (
              <div className="mt-0.5 hidden h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent text-[10px] font-bold text-accent-foreground sm:flex">
                LG
              </div>
            )}

            <div className={`${isUser ? 'max-w-[min(85%,36rem)]' : 'min-w-0 flex-1'}`}>
              <div
                className={
                  isUser
                    ? 'rounded-2xl rounded-br-md bg-foreground px-4 py-3 text-[14px] leading-6 text-background'
                    : 'min-w-0 text-[15px] leading-7 text-foreground'
                }
              >
                {isUser ? (
                  <p className="whitespace-pre-wrap">{message.content}</p>
                ) : message.content ? (
                  <CitationMarkdown
                    content={message.content}
                    onCitationClick={(label) =>
                      handleCitationClick(label, message)
                    }
                  />
                ) : isLastAssistant ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="status-dot warning animate-pulse" />
                    <span className="streaming-cursor text-[14px]">
                      Generating answer
                    </span>
                  </div>
                ) : null}
              </div>

              {message.status === 'failed' && (
                <div className="mt-3 rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-[13px]">
                  <p className="font-semibold text-destructive">
                    {message.error_code ?? 'Generation failed'}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    Retry keeps this chat intact. The composer stays available below.
                  </p>
                  {previousUserContent && (
                    <button
                      type="button"
                      className="btn-secondary mt-3 gap-1"
                      onClick={() => onRetry(previousUserContent)}
                    >
                      <IconRetry className="h-3.5 w-3.5" />
                      Retry this question
                    </button>
                  )}
                </div>
              )}

              {!isUser && message.skill && message.status === 'completed' && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <span>{message.skill}</span>
                  {message.provider && message.model && (
                    <span>
                      {message.provider} / {message.model}
                    </span>
                  )}
                  {message.sources.length > 0 && (
                    <span>{message.sources.length} sources</span>
                  )}
                  {message.latency_ms != null && (
                    <span>{(message.latency_ms / 1000).toFixed(1)}s</span>
                  )}
                </div>
              )}

              {message.status === 'cancelled' && (
                <p className="mt-2 text-[12px] text-muted-foreground">
                  Generation stopped. Partial response preserved — retry anytime.
                </p>
              )}

              {!isUser && message.status !== 'streaming' && (
                <MessageActions
                  message={message}
                  previousUserContent={previousUserContent}
                  onOpenSources={onOpenSources}
                  onRetry={onRetry}
                />
              )}
            </div>
          </article>
        );
      })}
      <div className="h-6" aria-hidden="true" />
    </div>
  );
}
