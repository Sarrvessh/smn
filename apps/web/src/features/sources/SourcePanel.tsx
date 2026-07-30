import type { Source, StreamSource } from '../../types/api';
import { useUiStore } from '../../stores/ui';

type AnySource = Source | StreamSource;

function getLabel(s: AnySource): string {
  return 'citation_label' in s ? s.citation_label : s.id;
}

function getRank(s: AnySource): number {
  return 'rank' in s ? s.rank : 0;
}

interface SourcePanelProps {
  sources: AnySource[];
}

export function SourcePanel({ sources }: SourcePanelProps) {
  const highlightedCitation = useUiStore((s) => s.highlightedCitation);

  if (sources.length === 0) {
    return null;
  }

  const sorted = [...sources].sort((a, b) => getRank(a) - getRank(b));

  return (
    <section
      className="border-t border-ink-200/60 bg-white/40 px-4 py-3"
      aria-label="Sources"
    >
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">
        Sources
      </h3>
      <ul className="space-y-2">
        {sorted.map((source) => {
          const label = getLabel(source);
          const isHighlighted = highlightedCitation === label;
          return (
            <li
              key={label}
              id={`source-${label}`}
              className={`rounded-lg border p-3 text-sm transition ${
                isHighlighted
                  ? 'border-accent bg-accent-light shadow-sm'
                  : 'border-ink-200/80 bg-white/80'
              }`}
            >
              <div className="mb-1 flex items-center gap-2">
                <span className="rounded bg-ink-100 px-1.5 py-0.5 text-xs font-semibold text-accent">
                  [{label}]
                </span>
                {source.guest && (
                  <span className="font-medium text-ink-800">{source.guest}</span>
                )}
              </div>
              {source.episode && (
                <p className="text-xs text-ink-500">{source.episode}</p>
              )}
              {source.excerpt && (
                <p className="mt-1 text-xs leading-relaxed text-ink-600 line-clamp-3">
                  {source.excerpt}
                </p>
              )}
              {'url' in source && source.url && (
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-xs text-accent hover:underline"
                >
                  View episode
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
