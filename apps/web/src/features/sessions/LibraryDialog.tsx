import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Session } from '../../types/api';
import { IconClose, IconLibrary } from '../../components/Icons';
import { useArchivedSessions } from '../../hooks/useSessions';

interface LibraryDialogProps {
  open: boolean;
  onClose: () => void;
  onRestore: (sessionId: string) => Promise<void>;
  isRestoring?: boolean;
}

function formatArchived(value: string | null) {
  if (!value) return 'Archived';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

export function LibraryDialog({
  open,
  onClose,
  onRestore,
  isRestoring = false,
}: LibraryDialogProps) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const { data: archived = [], isLoading, error, refetch } = useArchivedSessions(
    open,
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return archived;
    return archived.filter((s) => s.title.toLowerCase().includes(q));
  }, [archived, query]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setBusyId(null);
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

  const restore = async (session: Session) => {
    setBusyId(session.id);
    try {
      await onRestore(session.id);
      onClose();
    } finally {
      setBusyId(null);
    }
  };

  return createPortal(
    <div className="search-overlay" role="presentation">
      <button
        type="button"
        className="search-overlay-backdrop"
        aria-label="Close library"
        onClick={onClose}
      />
      <div
        className="search-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="flex items-center gap-2 border-b border-border px-4 py-3">
          <IconLibrary className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-[13px] font-semibold tracking-tight">
              Library
            </h2>
            <p className="text-[11px] text-muted-foreground">
              Archived research chats you can restore
            </p>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close library"
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
            placeholder="Filter archived chats…"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] tracking-tight text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-accent/30"
            autoComplete="off"
          />
        </div>

        <div className="scrollbar-stable max-h-[min(52vh,28rem)] overflow-y-auto p-2">
          {isLoading && (
            <div className="space-y-2 p-1" aria-label="Loading library">
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
              <p className="font-semibold text-destructive">Library could not load</p>
              <p className="mt-1 text-muted-foreground">
                {error instanceof Error ? error.message : 'Try again in a moment.'}
              </p>
            </div>
          )}

          {!isLoading && !error && results.length === 0 && (
            <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-muted text-muted-foreground">
                <IconLibrary className="h-4 w-4" />
              </div>
              <p className="text-[13px] font-semibold tracking-tight">
                {query.trim() ? 'No matching archives' : 'Library is empty'}
              </p>
              <p className="mt-1.5 max-w-xs text-[13px] leading-5 text-muted-foreground">
                {query.trim()
                  ? 'Try another title filter.'
                  : 'Archive a chat from Recents to keep it here without cluttering the sidebar.'}
              </p>
            </div>
          )}

          {!isLoading &&
            results.map((session) => (
              <div
                key={session.id}
                className="flex items-center gap-3 rounded-xl px-2.5 py-2.5 hover:bg-surface-hover"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-[11px] font-bold text-muted-foreground">
                  {session.title.trim().slice(0, 1).toUpperCase() || 'C'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium tracking-tight">
                    {session.title}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    Archived {formatArchived(session.archived_at)} · {session.model}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-secondary shrink-0"
                  disabled={isRestoring || busyId === session.id}
                  onClick={() => void restore(session)}
                >
                  {busyId === session.id ? 'Restoring…' : 'Restore'}
                </button>
              </div>
            ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
