import type { Source, StreamSource } from '../../types/api';
import { useUiStore } from '../../stores/ui';
import { IconClose } from '../../components/Icons';

type AnySource = Source | StreamSource;

function getLabel(s: AnySource): string {
  return 'citation_label' in s ? s.citation_label : s.id;
}

function getRank(s: AnySource): number {
  return 'rank' in s ? s.rank : Number(getLabel(s).replace(/\D/g, '')) || 0;
}

function getPublishDate(s: AnySource): string | null {
  if ('publish_date' in s && s.publish_date) return s.publish_date;
  return null;
}

function formatDate(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

interface SourcePanelProps {
  sources: AnySource[];
  open: boolean;
  onClose: () => void;
  highlightedLabel?: string | null;
}

export function SourcePanel({ sources, open, onClose }: SourcePanelProps) {
  const highlightedCitation = useUiStore((s) => s.highlightedCitation);
  const sorted = [...sources].sort((a, b) => getRank(a) - getRank(b));

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="absolute inset-0 z-20 bg-foreground/20 lg:bg-transparent"
        onClick={onClose}
        aria-label="Close sources backdrop"
      />
      <section
        className="panel-float absolute inset-x-3 bottom-3 z-30 flex max-h-[min(60dvh,28rem)] flex-col overflow-hidden rounded-2xl border border-border bg-surface-elevated lg:inset-x-auto lg:bottom-3 lg:right-3 lg:top-3 lg:w-[22rem] lg:max-h-none"
        aria-label="Transcript sources"
        aria-live="polite"
      >
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h3 className="truncate text-[13px] font-semibold tracking-tight">Sources</h3>
            <p className="text-[11px] text-muted-foreground">
              {sources.length === 0
                ? 'No transcript sources attached'
                : `${sources.length} cited ${sources.length === 1 ? 'source' : 'sources'}`}
            </p>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close sources"
            title="Close"
          >
            <IconClose />
          </button>
        </header>

        {sources.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
            <p className="text-[13px] font-semibold">No sources yet</p>
            <p className="mt-2 text-[12px] text-muted-foreground">
              Ask a grounded question and citations will appear here.
            </p>
          </div>
        ) : (
          <ol className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
            {sorted.map((source) => {
              const label = getLabel(source);
              const isHighlighted = highlightedCitation === label;
              const date = formatDate(getPublishDate(source));
              return (
                <li
                  key={label}
                  id={`source-${label}`}
                  className={`rounded-xl border p-3 text-[13px] transition ${
                    isHighlighted
                      ? 'border-accent/40 bg-surface-active'
                      : 'border-border bg-background'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="inline-flex rounded-md border border-accent/20 bg-surface-active px-1.5 py-0.5 text-[11px] font-semibold text-accent">
                        [{label}]
                      </span>
                      {source.guest && (
                        <p className="mt-2 truncate font-semibold tracking-tight">
                          {source.guest}
                        </p>
                      )}
                    </div>
                    {date && (
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {date}
                      </span>
                    )}
                  </div>
                  {source.episode && (
                    <p className="mt-1 line-clamp-2 text-[12px] font-medium text-muted-foreground">
                      {source.episode}
                    </p>
                  )}
                  {source.excerpt ? (
                    <blockquote className="mt-3 line-clamp-3 border-l-2 border-accent/40 pl-3 text-[12px] leading-5 text-muted-foreground">
                      {source.excerpt}
                    </blockquote>
                  ) : (
                    <p className="mt-3 text-[12px] text-muted-foreground">
                      No excerpt was returned for this citation.
                    </p>
                  )}
                  {'url' in source && source.url ? (
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex text-[12px] font-semibold text-accent underline-offset-2 hover:underline"
                    >
                      Open source
                    </a>
                  ) : (
                    <p className="mt-3 text-[12px] text-muted-foreground">
                      Source link unavailable
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </>
  );
}
