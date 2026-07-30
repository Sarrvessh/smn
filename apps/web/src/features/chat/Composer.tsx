import { useState } from 'react';
import type { ChatMode } from '../../types/api';
import { MODE_LABELS, SUGGESTED_PROMPTS } from '../../types/api';
import { useUiStore } from '../../stores/ui';

const MODES: ChatMode[] = [
  'auto',
  'transcript_qa',
  'ship30_essay',
  'artifact',
];

interface ComposerProps {
  disabled?: boolean;
  isStreaming: boolean;
  onSend: (content: string, mode: ChatMode) => void;
  onStop: () => void;
  showSuggestions?: boolean;
}

export function Composer({
  disabled,
  isStreaming,
  onSend,
  onStop,
  showSuggestions = false,
}: ComposerProps) {
  const mode = useUiStore((s) => s.mode);
  const setMode = useUiStore((s) => s.setMode);
  const [content, setContent] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || disabled || isStreaming) return;
    onSend(trimmed, mode);
    setContent('');
  };

  const handleSuggestion = (prompt: string) => {
    if (disabled || isStreaming) return;
    onSend(prompt, mode);
  };

  return (
    <div className="border-t border-ink-200/60 bg-white/50 px-4 py-3">
      {showSuggestions && (
        <div className="mb-3 flex flex-wrap gap-2">
          {SUGGESTED_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              className="btn-secondary max-w-full truncate text-left text-xs"
              onClick={() => handleSuggestion(prompt)}
              disabled={disabled || isStreaming}
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      <div className="mb-2 flex flex-wrap gap-1" role="radiogroup" aria-label="Chat mode">
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              mode === m
                ? 'bg-accent text-white'
                : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
            }`}
            onClick={() => setMode(m)}
            disabled={isStreaming}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <label className="sr-only" htmlFor="composer-input">
          Message
        </label>
        <textarea
          id="composer-input"
          rows={2}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
          placeholder="Ask about product growth, PMF, onboarding..."
          className="input-field min-h-[2.75rem] flex-1 resize-none"
          disabled={disabled || isStreaming}
        />
        {isStreaming ? (
          <button
            type="button"
            className="btn-secondary shrink-0 self-end border-red-200 text-red-700 hover:bg-red-50"
            onClick={onStop}
          >
            Stop
          </button>
        ) : (
          <button
            type="submit"
            className="btn-primary shrink-0 self-end"
            disabled={disabled || !content.trim()}
          >
            Send
          </button>
        )}
      </form>
    </div>
  );
}
