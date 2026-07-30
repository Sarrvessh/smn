import type { Components } from 'react-markdown';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import type { Message } from '../../types/api';
import { useUiStore } from '../../stores/ui';

interface MessageListProps {
  messages: Message[];
  isStreaming: boolean;
}

function CitationMarkdown({
  content,
  onCitationClick,
}: {
  content: string;
  onCitationClick: (label: string) => void;
}) {
  // Turn [S1] into markdown links so headings/lists still parse correctly.
  const linked = content.replace(/\[(S\d+)\]/g, '[$1](citation:$1)');

  const components: Components = {
    a: ({ href, children }) => {
      if (href?.startsWith('citation:')) {
        const label = href.slice('citation:'.length);
        return (
          <button
            type="button"
            className="citation-link mx-0.5 align-baseline"
            onClick={() => onCitationClick(label)}
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
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={components}
      >
        {linked}
      </ReactMarkdown>
    </div>
  );
}

export function MessageList({ messages, isStreaming }: MessageListProps) {
  const setHighlightedCitation = useUiStore((s) => s.setHighlightedCitation);
  const setActiveSources = useUiStore((s) => s.setActiveSources);

  const handleCitationClick = (label: string, message: Message) => {
    setHighlightedCitation(label);
    if (message.sources.length > 0) {
      setActiveSources(message.sources);
    }
  };

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <h2 className="text-lg font-semibold text-ink-800">
          Ask Lenny&apos;s guests anything
        </h2>
        <p className="mt-2 max-w-md text-sm text-ink-500">
          Grounded answers from Lenny&apos;s Podcast transcripts with citations,
          essays, and artifacts.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      {messages.map((message, idx) => {
        const isLastAssistant =
          message.role === 'assistant' &&
          idx === messages.length - 1 &&
          isStreaming;

        return (
          <article
            key={message.id}
            className={`max-w-3xl ${
              message.role === 'user' ? 'ml-auto' : 'mr-auto'
            }`}
          >
            <div
              className={`rounded-xl px-4 py-3 ${
                message.role === 'user'
                  ? 'bg-accent text-white'
                  : 'panel shadow-sm'
              }`}
            >
              <header className="mb-1 text-xs font-medium opacity-70">
                {message.role === 'user' ? 'You' : 'Assistant'}
                {message.status === 'failed' && ' — Error'}
                {message.status === 'cancelled' && ' — Stopped'}
                {isLastAssistant && !message.content && ' — thinking…'}
              </header>
              <div
                className={`text-sm leading-relaxed ${
                  isLastAssistant ? 'streaming-cursor' : ''
                }`}
              >
                {message.role === 'assistant' ? (
                  message.content ? (
                    <CitationMarkdown
                      content={message.content}
                      onCitationClick={(label) =>
                        handleCitationClick(label, message)
                      }
                    />
                  ) : isLastAssistant ? (
                    <p className="text-ink-400 italic">
                      Generating grounded answer from transcripts…
                    </p>
                  ) : null
                ) : (
                  <p className="whitespace-pre-wrap">{message.content}</p>
                )}
              </div>
              {message.status === 'failed' && message.error_code && (
                <p className="mt-2 text-xs text-red-600">
                  {message.error_code}
                </p>
              )}
              {message.skill && message.status === 'completed' && (
                <p className="mt-2 text-xs text-ink-400">
                  {message.skill}
                  {message.latency_ms != null && ` · ${message.latency_ms}ms`}
                </p>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
