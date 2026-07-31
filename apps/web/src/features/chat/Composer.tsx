import { useLayoutEffect, useRef, useState } from 'react';
import type { ChatMode } from '../../types/api';
import { MODE_LABELS } from '../../types/api';
import { useUiStore } from '../../stores/ui';
import { IconSend, IconStop } from '../../components/Icons';

const MODES: ChatMode[] = [
  'auto',
  'transcript_qa',
  'ship30_essay',
  'artifact',
];

const MAX_CHARS = 6000;

interface ComposerProps {
  /** Soft gate: blocks send but never blocks typing */
  sendBlocked?: boolean;
  blockedReason?: string | null;
  isStreaming: boolean;
  onSend: (content: string, mode: ChatMode) => void | Promise<void>;
  onStop: () => void;
}

function modeDescription(mode: ChatMode) {
  switch (mode) {
    case 'transcript_qa':
      return 'Grounded transcript Q&A';
    case 'ship30_essay':
      return 'Essay artifact mode';
    case 'artifact':
      return 'Markdown or HTML artifact';
    default:
      return 'Route automatically';
  }
}

export function Composer({
  sendBlocked = false,
  blockedReason,
  isStreaming,
  onSend,
  onStop,
}: ComposerProps) {
  const mode = useUiStore((s) => s.mode);
  const setMode = useUiStore((s) => s.setMode);
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const trimmed = content.trim();
  const overLimit = content.length > MAX_CHARS;
  const canSend =
    !!trimmed && !sendBlocked && !isStreaming && !overLimit && !sending;

  useLayoutEffect(() => {
    const node = textareaRef.current;
    if (!node) return;
    node.style.height = 'auto';
    node.style.height = `${Math.min(Math.max(node.scrollHeight, 44), 200)}px`;
  }, [content]);

  const submitContent = async () => {
    setLocalError(null);
    if (!trimmed) {
      setLocalError('Type a message first.');
      textareaRef.current?.focus();
      return;
    }
    if (overLimit) {
      setLocalError(`Message is too long (max ${MAX_CHARS} characters).`);
      return;
    }
    if (isStreaming) {
      setLocalError('Wait for the current response to finish, or press Stop.');
      return;
    }
    if (sendBlocked) {
      setLocalError(blockedReason || 'Sending is unavailable right now.');
      return;
    }
    if (sending) return;

    const payload = trimmed;
    setSending(true);
    try {
      await onSend(payload, mode);
      setContent('');
      setLocalError(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not send message.';
      setLocalError(message);
      // Keep the draft so the user can retry
      setContent(payload);
    } finally {
      setSending(false);
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void submitContent();
  };

  const statusMessage = localError || blockedReason;

  return (
    <div
      id="composer-dock"
      className="safe-bottom sticky bottom-0 z-30 border-t border-border/80 bg-background/90 px-3 pt-3 backdrop-blur-md sm:px-5"
    >
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="segmented" role="radiogroup" aria-label="Chat mode">
            {MODES.map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                className="segmented-button"
                onClick={() => setMode(m)}
                disabled={isStreaming || sending}
                title={modeDescription(m)}
              >
                {MODE_LABELS[m]}
              </button>
            ))}
          </div>
          <p
            className={`text-[11px] tabular-nums ${
              overLimit ? 'text-destructive' : 'text-muted-foreground'
            }`}
          >
            {content.length}/{MAX_CHARS}
          </p>
        </div>

        {statusMessage && (
          <p
            className={`mb-2 rounded-lg border px-3 py-2 text-[12px] leading-5 ${
              localError
                ? 'border-destructive/30 bg-destructive/10 text-foreground'
                : 'border-warning/25 bg-warning/10 text-foreground'
            }`}
            role="status"
          >
            {statusMessage}
          </p>
        )}

        <form
          onSubmit={handleSubmit}
          className="composer-shell surface-elevated flex items-end gap-2 rounded-2xl border-border/80 p-2"
        >
          <label className="sr-only" htmlFor="composer-input">
            Message
          </label>
          <textarea
            ref={textareaRef}
            id="composer-input"
            rows={1}
            value={content}
            maxLength={MAX_CHARS + 500}
            onChange={(e) => {
              setContent(e.target.value);
              if (localError) setLocalError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void submitContent();
              }
            }}
            placeholder="Ask about PMF, onboarding, growth loops…"
            className="max-h-[200px] min-h-11 flex-1 resize-none overflow-y-auto bg-transparent px-2 py-2.5 text-[15px] leading-6 text-foreground placeholder:text-muted-foreground/65 focus:outline-none"
            aria-describedby="composer-help"
          />
          {isStreaming ? (
            <button
              type="button"
              className="btn-secondary mb-0.5 h-9 w-9 shrink-0 rounded-xl border-destructive/30 p-0 text-destructive"
              onClick={onStop}
              aria-label="Stop generation"
              title="Stop"
            >
              <IconStop className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              type="submit"
              className="btn-primary mb-0.5 h-9 w-9 shrink-0 rounded-xl p-0"
              disabled={!canSend}
              aria-label="Send message"
              title={
                sendBlocked
                  ? blockedReason || 'Sending unavailable'
                  : sending
                    ? 'Sending…'
                    : 'Send'
              }
            >
              <IconSend className="h-4 w-4" />
            </button>
          )}
        </form>
        <p id="composer-help" className="px-1 pt-2 text-[11px] text-muted-foreground">
          Enter to send · Shift+Enter for a new line
        </p>
      </div>
    </div>
  );
}
