import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Session } from '../../types/api';
import { IconClose, IconSearch } from '../../components/Icons';

type SearchFilter = 'all' | 'today' | 'earlier';

interface SessionSearchDialogProps {
  open: boolean;
  onClose: () => void;
  sessions: Session[];
  isLoading?: boolean;
  selectedSessionId: string | null;
  onSelect: (sessionId: string) => void;
}

function dayStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isToday(value: string) {
  return new Date(value) >= dayStart(new Date());
}

function formatRelative(value: string) {
  const date = new Date(value);
  const start = dayStart(new Date());
  const yesterday = new Date(start);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date >= start) return 'Today';
  if (date >= yesterday) return 'Yesterday';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

const FILTERS: { id: SearchFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'today', label: 'Today' },
  { id: 'earlier', label: 'Earlier' },
];

export function SessionSearchDialog({
  open,
  onClose,
  sessions,
  isLoading = false,
  selectedSessionId,
  onSelect,
}: SessionSearchDialogProps) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<SearchFilter>('all');
  const [highlight, setHighlight] = useState(0);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sessions.filter((session) => {
      if (q && !session.title.toLowerCase().includes(q)) return false;
      if (filter === 'today') return isToday(session.updated_at);
      if (filter === 'earlier') return !isToday(session.updated_at);
      return true;
    });
  }, [sessions, query, filter]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setFilter('all');
    setHighlight(0);
    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  useEffect(() => {
    setHighlight(0);
  }, [query, filter]);

  useEffect(() => {
    if (!open) return;
    const node = listRef.current?.querySelector<HTMLElement>(
      `[data-search-index="${highlight}"]`,
    );
    node?.scrollIntoView({ block: 'nearest' });
  }, [highlight, open, results.length]);

  if (!open) return null;

  const selectAt = (index: number) => {
    const session = results[index];
    if (!session) return;
    onSelect(session.id);
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (results.length === 0) return;
      setHighlight((h) => (h + 1) % results.length);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (results.length === 0) return;
      setHighlight((h) => (h - 1 + results.length) % results.length);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      selectAt(highlight);
    }
  };

  const modKey =
    typeof navigator !== 'undefined' &&
    /Mac|iPhone|iPad/.test(navigator.platform)
      ? '⌘'
      : 'Ctrl';

  return createPortal(
    <div className="search-overlay" role="presentation" onKeyDown={onKeyDown}>
      <button
        type="button"
        className="search-overlay-backdrop"
        aria-label="Close search"
        onClick={onClose}
      />
      <div
        className="search-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="flex items-center gap-2 border-b border-border px-4 py-3">
          <IconSearch className="h-4 w-4 shrink-0 text-muted-foreground" />
          <label className="sr-only" htmlFor="session-search-input" id={titleId}>
            Search chats
          </label>
          <input
            ref={inputRef}
            id="session-search-input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats…"
            className="min-w-0 flex-1 bg-transparent text-[15px] tracking-tight text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
            autoComplete="off"
            spellCheck={false}
          />
          {query ? (
            <button
              type="button"
              className="btn-ghost h-7 px-2 text-[13px]"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
            >
              Clear
            </button>
          ) : (
            <kbd className="hidden rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground sm:inline">
              Esc
            </kbd>
          )}
          <span className="h-4 w-px bg-border" aria-hidden="true" />
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close search"
            title="Close"
          >
            <IconClose />
          </button>
        </header>

        <div
          className="flex gap-1 overflow-x-auto border-b border-border px-3 py-2"
          role="tablist"
          aria-label="Search filters"
        >
          {FILTERS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={filter === tab.id}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-medium tracking-tight transition ${
                filter === tab.id
                  ? 'bg-surface-active text-foreground'
                  : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground'
              }`}
              onClick={() => setFilter(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div
          ref={listRef}
          className="scrollbar-stable max-h-[min(52vh,28rem)] overflow-y-auto p-2"
          role="listbox"
          aria-label="Chat results"
        >
          {isLoading && (
            <div className="space-y-2 p-1" aria-label="Loading chats">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl px-2 py-2.5">
                  <div className="skeleton h-9 w-9 shrink-0 rounded-lg" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="skeleton h-3 w-2/5" />
                    <div className="skeleton h-2.5 w-3/5" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isLoading && results.length === 0 && (
            <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-muted text-muted-foreground">
                <IconSearch className="h-4 w-4" />
              </div>
              <p className="text-[13px] font-semibold tracking-tight">
                {query.trim() ? 'No matching chats' : 'No chats in this view'}
              </p>
              <p className="mt-1.5 max-w-xs text-[13px] leading-5 text-muted-foreground">
                {query.trim()
                  ? 'Try a shorter title, or clear the search and browse by Today / Earlier.'
                  : 'Start a conversation, then find it here anytime.'}
              </p>
            </div>
          )}

          {!isLoading &&
            results.map((session, index) => {
              const active = index === highlight;
              const current = session.id === selectedSessionId;
              return (
                <button
                  key={session.id}
                  type="button"
                  role="option"
                  data-search-index={index}
                  aria-selected={active}
                  className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition ${
                    active
                      ? 'bg-surface-active'
                      : 'hover:bg-surface-hover'
                  }`}
                  onMouseEnter={() => setHighlight(index)}
                  onClick={() => selectAt(index)}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold ${
                      current
                        ? 'bg-accent text-accent-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {session.title.trim().slice(0, 1).toUpperCase() || 'C'}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium tracking-tight text-foreground">
                      {session.title}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                      {formatRelative(session.updated_at)}
                      {current ? ' · Open now' : ''}
                      {' · '}
                      {session.model}
                    </span>
                  </span>
                </button>
              );
            })}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground">
          <span>
            {results.length} {results.length === 1 ? 'chat' : 'chats'}
          </span>
          <span className="hidden sm:inline">
            ↑↓ to move · Enter to open · {modKey}K anytime
          </span>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
