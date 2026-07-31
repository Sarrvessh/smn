import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ChatMode } from '../../types/api';
import { MODE_LABELS } from '../../types/api';
import { useUiStore } from '../../stores/ui';
import { IconClose, IconSend, IconStop } from '../../components/Icons';

const MAX_CHARS = 6000;

/** Skills exposed via `/` — auto is the default when nothing is selected. */
const SKILLS: {
  mode: Exclude<ChatMode, 'auto'>;
  command: string;
  label: string;
  description: string;
}[] = [
  {
    mode: 'transcript_qa',
    command: 'ask',
    label: MODE_LABELS.transcript_qa,
    description: 'Grounded Q&A from Lenny’s podcast transcripts',
  },
  {
    mode: 'ship30_essay',
    command: 'essay',
    label: MODE_LABELS.ship30_essay,
    description: 'Turn insight into a Ship30for30 essay artifact',
  },
  {
    mode: 'artifact',
    command: 'artifact',
    label: MODE_LABELS.artifact,
    description: 'Generate a Markdown or HTML artifact',
  },
];

interface ComposerProps {
  /** Soft gate: blocks send but never blocks typing */
  sendBlocked?: boolean;
  blockedReason?: string | null;
  isStreaming: boolean;
  onSend: (content: string, mode: ChatMode) => void | Promise<void>;
  onStop: () => void;
}

/** Detect a slash command token at the caret (start of text or after whitespace). */
function getSlashQuery(value: string, caret: number) {
  const before = value.slice(0, caret);
  const match = before.match(/(?:^|\s)\/([^\s]*)$/);
  if (!match) return null;
  const query = match[1] ?? '';
  const start = before.length - query.length - 1; // index of '/'
  return { query, start, end: caret };
}

function stripSlashToken(value: string, start: number, end: number) {
  const before = value.slice(0, start);
  const after = value.slice(end);
  // Drop a trailing space left behind when the slash sat after whitespace
  const cleanedBefore = before.replace(/\s$/, '');
  const cleanedAfter = after.replace(/^\s+/, '');
  if (!cleanedBefore) return cleanedAfter;
  if (!cleanedAfter) return cleanedBefore;
  return `${cleanedBefore} ${cleanedAfter}`;
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const [slashRange, setSlashRange] = useState<{ start: number; end: number } | null>(
    null,
  );
  const [highlight, setHighlight] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const trimmed = content.trim();
  const overLimit = content.length > MAX_CHARS;
  const canSend =
    !!trimmed &&
    !menuOpen &&
    !sendBlocked &&
    !isStreaming &&
    !overLimit &&
    !sending;

  const filteredSkills = useMemo(() => {
    const q = slashQuery.toLowerCase();
    if (!q) return SKILLS;
    return SKILLS.filter(
      (s) =>
        s.command.startsWith(q) ||
        s.label.toLowerCase().includes(q) ||
        s.mode.includes(q),
    );
  }, [slashQuery]);

  useLayoutEffect(() => {
    const node = textareaRef.current;
    if (!node) return;
    node.style.height = 'auto';
    node.style.height = `${Math.min(Math.max(node.scrollHeight, 44), 200)}px`;
  }, [content]);

  useLayoutEffect(() => {
    setHighlight(0);
  }, [slashQuery, menuOpen]);

  const syncSlashMenu = (value: string, caret: number) => {
    const hit = getSlashQuery(value, caret);
    if (!hit) {
      setMenuOpen(false);
      setSlashQuery('');
      setSlashRange(null);
      return;
    }
    setMenuOpen(true);
    setSlashQuery(hit.query);
    setSlashRange({ start: hit.start, end: hit.end });
  };

  const selectSkill = (skill: (typeof SKILLS)[number]) => {
    const range = slashRange;
    const next = range
      ? stripSlashToken(content, range.start, range.end)
      : content.replace(/^\s*\/[^\s]*/, '').trimStart();
    setMode(skill.mode);
    setContent(next);
    setMenuOpen(false);
    setSlashQuery('');
    setSlashRange(null);
    setLocalError(null);
    requestAnimationFrame(() => {
      const node = textareaRef.current;
      if (!node) return;
      node.focus({ preventScroll: true });
      const pos = next.length;
      node.setSelectionRange(pos, pos);
    });
  };

  const clearSkill = () => {
    setMode('auto');
    requestAnimationFrame(() => textareaRef.current?.focus({ preventScroll: true }));
  };

  const submitContent = async () => {
    if (menuOpen) return;
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
    setContent('');
    setLocalError(null);
    setSending(true);
    try {
      await onSend(payload, mode);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not send message.';
      setLocalError(message);
      setContent(payload);
    } finally {
      setSending(false);
      requestAnimationFrame(() => {
        textareaRef.current?.focus({ preventScroll: true });
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void submitContent();
  };

  const statusMessage = localError || blockedReason;
  const activeSkill = mode === 'auto' ? null : SKILLS.find((s) => s.mode === mode);

  return (
    <div
      id="composer-dock"
      className="safe-bottom z-20 border-t border-border/80 bg-background px-3 pt-3 sm:px-5"
    >
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-muted-foreground">
            Type <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">/</kbd> to pick a skill
          </p>
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

        <div className="relative">
          {menuOpen && (
            <div
              id="skill-slash-menu"
              className="absolute bottom-full left-0 right-0 z-40 mb-2 overflow-hidden rounded-xl border border-border bg-surface-elevated shadow-[var(--panel-shadow)]"
              role="listbox"
              aria-label="Skills"
            >
              <div className="border-b border-border px-3 py-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Skills
                </p>
              </div>
              {filteredSkills.length === 0 ? (
                <p className="px-3 py-3 text-[13px] text-muted-foreground">
                  No skills match <span className="font-mono">/{slashQuery}</span>
                </p>
              ) : (
                <ul className="max-h-64 overflow-y-auto py-1">
                  {filteredSkills.map((skill, index) => {
                    const active = index === highlight;
                    return (
                      <li key={skill.mode}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={active}
                          className={`flex w-full items-start gap-3 px-3 py-2.5 text-left transition ${
                            active ? 'bg-surface-active' : 'hover:bg-surface-hover'
                          }`}
                          onMouseEnter={() => setHighlight(index)}
                          onClick={() => selectSkill(skill)}
                        >
                          <span className="mt-0.5 shrink-0 rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                            /{skill.command}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-[13px] font-medium text-foreground">
                              {skill.label}
                            </span>
                            <span className="mt-0.5 block text-[12px] leading-5 text-muted-foreground">
                              {skill.description}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="composer-shell surface-elevated flex flex-col gap-2 rounded-2xl border-border/80 p-2"
          >
            {activeSkill && (
              <div className="flex items-center gap-2 px-1 pt-0.5">
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-accent/25 bg-surface-active px-2 py-1 text-[12px] font-medium text-foreground">
                  <span className="font-mono text-[11px] text-muted-foreground">
                    /{activeSkill.command}
                  </span>
                  {activeSkill.label}
                  <button
                    type="button"
                    className="ml-0.5 rounded p-0.5 text-muted-foreground transition hover:bg-surface-hover hover:text-foreground"
                    onClick={clearSkill}
                    aria-label="Clear skill"
                    title="Clear skill"
                    disabled={isStreaming || sending}
                  >
                    <IconClose className="h-3 w-3" />
                  </button>
                </span>
              </div>
            )}

            <div className="flex items-end gap-2">
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
                  const value = e.target.value;
                  setContent(value);
                  if (localError) setLocalError(null);
                  syncSlashMenu(value, e.target.selectionStart ?? value.length);
                }}
                onClick={(e) => {
                  const target = e.currentTarget;
                  syncSlashMenu(target.value, target.selectionStart ?? 0);
                }}
                onKeyUp={(e) => {
                  if (
                    e.key === 'ArrowLeft' ||
                    e.key === 'ArrowRight' ||
                    e.key === 'Home' ||
                    e.key === 'End'
                  ) {
                    const target = e.currentTarget;
                    syncSlashMenu(target.value, target.selectionStart ?? 0);
                  }
                }}
                onKeyDown={(e) => {
                  if (menuOpen) {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setHighlight((h) =>
                        filteredSkills.length
                          ? (h + 1) % filteredSkills.length
                          : 0,
                      );
                      return;
                    }
                    if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setHighlight((h) =>
                        filteredSkills.length
                          ? (h - 1 + filteredSkills.length) % filteredSkills.length
                          : 0,
                      );
                      return;
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      setMenuOpen(false);
                      return;
                    }
                    if (e.key === 'Enter' || e.key === 'Tab') {
                      e.preventDefault();
                      const skill = filteredSkills[highlight];
                      if (skill) selectSkill(skill);
                      return;
                    }
                  }

                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void submitContent();
                  }

                  if (e.key === 'Backspace' && mode !== 'auto' && content === '') {
                    e.preventDefault();
                    clearSkill();
                  }
                }}
                onBlur={() => {
                  // Delay so option click can fire first
                  window.setTimeout(() => setMenuOpen(false), 150);
                }}
                placeholder={
                  activeSkill
                    ? `Message for ${activeSkill.label}…`
                    : 'Ask about PMF, onboarding, growth loops… or type /'
                }
                className="max-h-[200px] min-h-11 flex-1 resize-none overflow-y-auto bg-transparent px-2 py-2.5 text-[15px] leading-6 text-foreground placeholder:text-muted-foreground/65 focus:outline-none"
                aria-describedby="composer-help"
                aria-expanded={menuOpen}
                aria-controls="skill-slash-menu"
                autoComplete="off"
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
            </div>
          </form>
        </div>
        <p id="composer-help" className="px-1 pt-2 text-[11px] text-muted-foreground">
          / for skills · Enter to send · Shift+Enter for a new line
        </p>
      </div>
    </div>
  );
}
