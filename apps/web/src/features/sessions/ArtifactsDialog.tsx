import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ArtifactListItem } from '../../types/api';
import { IconClose, IconPanel } from '../../components/Icons';
import { useArtifacts } from '../../hooks/useArtifacts';

interface ArtifactsDialogProps {
  open: boolean;
  onClose: () => void;
  onOpen: (item: ArtifactListItem) => void;
  selectedArtifactId?: string | null;
}

function formatCreated(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function typeLabel(item: ArtifactListItem) {
  const t = (item.type || item.language || 'markdown').toLowerCase();
  if (t === 'html') return 'HTML';
  if (t === 'markdown' || t === 'md') return 'Markdown';
  return t;
}

export function ArtifactsDialog({
  open,
  onClose,
  onOpen,
  selectedArtifactId = null,
}: ArtifactsDialogProps) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState('');
  const { data: artifacts = [], isLoading, error, refetch } = useArtifacts(open);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return artifacts;
    return artifacts.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.session_title.toLowerCase().includes(q) ||
        typeLabel(a).toLowerCase().includes(q),
    );
  }, [artifacts, query]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    void refetch();
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = prev;
    };
  }, [open, refetch]);

  if (!open) return null;

  return createPortal(
    <div className="search-overlay" role="presentation">
      <button
        type="button"
        className="search-overlay-backdrop"
        aria-label="Close artifacts"
        onClick={onClose}
      />
      <div
        className="search-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="flex items-center gap-2 border-b border-border px-4 py-3">
          <IconPanel className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-[13px] font-semibold tracking-tight">
              Artifacts
            </h2>
            <p className="text-[11px] text-muted-foreground">
              Essays and generated work, linked to their chat
            </p>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close artifacts"
            title="Close"
          >
            <IconClose />
          </button>
        </header>

        <div className="border-b border-border px-4 py-2.5">
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by title or chat…"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] tracking-tight text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-accent/30"
            autoComplete="off"
          />
        </div>

        <div className="scrollbar-stable max-h-[min(52vh,28rem)] overflow-y-auto p-2">
          {isLoading && (
            <div className="space-y-2 p-1" aria-label="Loading artifacts">
              {[0, 1, 2].map((i) => (
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

          {error && (
            <div className="rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-3 text-[13px]">
              <p className="font-semibold text-destructive">Artifacts could not load</p>
              <p className="mt-1 text-muted-foreground">
                {error instanceof Error ? error.message : 'Try again in a moment.'}
              </p>
            </div>
          )}

          {!isLoading && !error && results.length === 0 && (
            <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-muted text-muted-foreground">
                <IconPanel className="h-4 w-4" />
              </div>
              <p className="text-[13px] font-semibold tracking-tight">
                {query.trim() ? 'No matching artifacts' : 'No artifacts yet'}
              </p>
              <p className="mt-1.5 max-w-xs text-[13px] leading-5 text-muted-foreground">
                {query.trim()
                  ? 'Try another title or chat filter.'
                  : 'Ship30 essays and Markdown/HTML artifacts appear here when a chat creates them.'}
              </p>
            </div>
          )}

          {!isLoading &&
            results.map((item) => {
              const selected = item.id === selectedArtifactId;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors hover:bg-surface-hover ${
                    selected ? 'bg-surface-active' : ''
                  }`}
                  onClick={() => onOpen(item)}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-[10px] font-bold uppercase tracking-wide text-accent">
                    {typeLabel(item) === 'HTML' ? 'HTML' : 'MD'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium tracking-tight">
                      {item.title}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      From “{item.session_title}”
                      {item.session_archived ? ' · Archived chat' : ''}
                      {' · '}
                      {formatCreated(item.created_at)}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
                    Open
                  </span>
                </button>
              );
            })}
        </div>
      </div>
    </div>,
    document.body,
  );
}
