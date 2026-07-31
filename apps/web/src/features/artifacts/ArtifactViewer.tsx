import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { getArtifact, isMockMode } from '../../lib/api';
import { mockApi } from '../../lib/mock';
import { useUiStore } from '../../stores/ui';
import { IconClose, IconCopy, IconExpand } from '../../components/Icons';

type Tab = 'preview' | 'code';

function buildSandboxHtml(content: string): string {
  const csp = [
    "default-src 'none'",
    "style-src 'unsafe-inline'",
    "img-src data: https:",
    "font-src data: https:",
    "base-uri 'none'",
    "form-action 'none'",
    "script-src 'none'",
  ].join('; ');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="referrer" content="no-referrer" />
  <style>
    :root { color-scheme: light; }
    body {
      margin: 0;
      min-height: 100vh;
      background: #f8f7f4;
      color: #22201d;
      font-family: Inter, system-ui, sans-serif;
    }
  </style>
</head>
<body>${content}</body>
</html>`;
}

function numberedCode(content: string) {
  return content.split('\n').map((line, index) => ({
    number: index + 1,
    line,
  }));
}

export function ArtifactViewer() {
  const selectedArtifactId = useUiStore((s) => s.selectedArtifactId);
  const setArtifactPanelOpen = useUiStore((s) => s.setArtifactPanelOpen);
  const artifactFullscreen = useUiStore((s) => s.artifactFullscreen);
  const setArtifactFullscreen = useUiStore((s) => s.setArtifactFullscreen);
  const [tab, setTab] = useState<Tab>('preview');
  const [copied, setCopied] = useState(false);

  const { data: artifact, isLoading, error } = useQuery({
    queryKey: ['artifact', selectedArtifactId],
    queryFn: () => {
      if (!selectedArtifactId) throw new Error('No artifact');
      return isMockMode()
        ? mockApi.getArtifact(selectedArtifactId)
        : getArtifact(selectedArtifactId);
    },
    enabled: !!selectedArtifactId,
  });

  const codeLines = useMemo(
    () => numberedCode(artifact?.content ?? ''),
    [artifact?.content],
  );

  const handleCopy = async () => {
    if (!artifact) return;
    await navigator.clipboard.writeText(artifact.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleDownload = () => {
    if (!artifact) return;
    const ext =
      artifact.type === 'html' || artifact.language === 'html' ? 'html' : 'md';
    const blob = new Blob([artifact.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${artifact.title.replace(/\s+/g, '-').toLowerCase()}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isHtml = artifact?.type === 'html' || artifact?.language === 'html';

  return (
    <aside
      className={`surface-panel flex h-full w-full flex-col border-l ${
        artifactFullscreen ? 'fixed inset-0 z-50 border-l-0' : ''
      }`}
      aria-label="Artifact workspace"
    >
      <header className="flex min-h-12 items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <div className="min-w-0">
          <h2 className="truncate text-[13px] font-semibold tracking-tight">
            {artifact?.title ?? 'Artifact workspace'}
          </h2>
          <p className="text-[11px] text-muted-foreground">
            {artifact
              ? `${artifact.type} / ${artifact.language}`
              : 'Preview generated work beside the chat'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            className="icon-button"
            onClick={() => void handleCopy()}
            disabled={!artifact}
            aria-label="Copy artifact"
            title={copied ? 'Copied' : 'Copy'}
          >
            <IconCopy />
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={handleDownload}
            disabled={!artifact}
            aria-label="Download artifact"
            title="Download"
          >
            <IconCopy className="opacity-70" />
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={() => setArtifactFullscreen(!artifactFullscreen)}
            disabled={!artifact}
            aria-label={artifactFullscreen ? 'Exit fullscreen' : 'Fullscreen artifact'}
            title={artifactFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            <IconExpand />
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={() => setArtifactPanelOpen(false)}
            aria-label="Close artifact workspace"
            title="Close"
          >
            <IconClose />
          </button>
        </div>
      </header>

      <div className="flex border-b border-border px-4" role="tablist" aria-label="Artifact view">
        {(['preview', 'code'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            className="segmented-button rounded-none border-b-2 border-transparent px-3 py-3 capitalize aria-selected:border-accent aria-selected:bg-transparent aria-selected:shadow-none"
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-muted/35 p-3">
        {!selectedArtifactId && (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <div className="max-w-sm">
              <p className="text-sm font-semibold">No artifact selected</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Ship30 essays, Markdown briefs, and HTML strategy dashboards open here when a response creates one.
              </p>
            </div>
          </div>
        )}

        {selectedArtifactId && isLoading && (
          <div className="space-y-3 p-3" aria-label="Loading artifact">
            <div className="skeleton h-8 w-2/3" />
            <div className="skeleton h-36 w-full" />
            <div className="skeleton h-36 w-full" />
          </div>
        )}

        {error && (
          <div className="surface-elevated rounded-lg p-4 text-sm">
            <p className="font-semibold text-destructive">Artifact could not load</p>
            <p className="mt-2 text-muted-foreground">
              Select another artifact or retry the generation from the chat.
            </p>
          </div>
        )}

        {artifact && tab === 'code' && (
          <pre className="min-h-full overflow-auto rounded-lg border border-border bg-foreground p-0 font-mono text-xs leading-6 text-background dark:bg-black/40 dark:text-foreground">
            <code className="block min-w-max py-3">
              {codeLines.map(({ number, line }) => (
                <span key={number} className="grid grid-cols-[3.5rem_minmax(0,1fr)]">
                  <span className="select-none border-r border-background/20 px-3 text-right text-background/55 dark:border-foreground/15 dark:text-foreground/45">
                    {number}
                  </span>
                  <span className="whitespace-pre px-3">{line || ' '}</span>
                </span>
              ))}
            </code>
          </pre>
        )}

        {artifact && tab === 'preview' && (
          <>
            {isHtml ? (
              <iframe
                title={artifact.title}
                sandbox=""
                referrerPolicy="no-referrer"
                srcDoc={buildSandboxHtml(artifact.content)}
                className="h-full min-h-[32rem] w-full rounded-lg border border-border bg-white"
              />
            ) : (
              <article className="markdown-body mx-auto min-h-full max-w-3xl rounded-xl border border-border bg-surface-elevated px-5 py-6 sm:px-8">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeSanitize]}
                >
                  {artifact.content}
                </ReactMarkdown>
              </article>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
