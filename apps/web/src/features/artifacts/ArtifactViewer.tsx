import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { getArtifact, isMockMode } from '../../lib/api';
import { mockApi } from '../../lib/mock';
import { useUiStore } from '../../stores/ui';

type Tab = 'preview' | 'code';

function buildSandboxHtml(content: string): string {
  const csp = [
    "default-src 'none'",
    "style-src 'unsafe-inline'",
    "img-src data: https:",
    "font-src data: https:",
  ].join('; ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="referrer" content="no-referrer" />
  <style>
    body { font-family: 'IBM Plex Sans', system-ui, sans-serif; margin: 1rem; color: #352d25; background: #f6f1e8; }
  </style>
</head>
<body>${content}</body>
</html>`;
}

export function ArtifactViewer() {
  const selectedArtifactId = useUiStore((s) => s.selectedArtifactId);
  const setArtifactPanelOpen = useUiStore((s) => s.setArtifactPanelOpen);
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

  const handleCopy = async () => {
    if (!artifact) return;
    await navigator.clipboard.writeText(artifact.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

  if (!selectedArtifactId) {
    return (
      <aside className="flex h-full w-full flex-col panel border-l-0 lg:border-l">
        <header className="border-b border-ink-200/60 px-4 py-3">
          <h2 className="text-sm font-semibold text-ink-800">Artifact Viewer</h2>
        </header>
        <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-ink-500">
          Generated essays and artifacts appear here.
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-full flex-col panel border-l-0 lg:border-l">
      <header className="flex items-center justify-between gap-2 border-b border-ink-200/60 px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-ink-800">
            {artifact?.title ?? 'Artifact'}
          </h2>
          {artifact && (
            <p className="text-xs text-ink-500">{artifact.type}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            className="btn-secondary text-xs lg:hidden"
            onClick={() => setArtifactPanelOpen(false)}
            aria-label="Close artifact panel"
          >
            Close
          </button>
          <button
            type="button"
            className="btn-secondary text-xs"
            onClick={() => void handleCopy()}
            disabled={!artifact}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            type="button"
            className="btn-secondary text-xs"
            onClick={handleDownload}
            disabled={!artifact}
          >
            Download
          </button>
        </div>
      </header>

      <div className="flex border-b border-ink-200/60 px-4" role="tablist">
        {(['preview', 'code'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            className={`border-b-2 px-3 py-2 text-xs font-medium capitalize transition ${
              tab === t
                ? 'border-accent text-accent'
                : 'border-transparent text-ink-500 hover:text-ink-700'
            }`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-4">
        {isLoading && (
          <p className="text-sm text-ink-500">Loading artifact...</p>
        )}
        {error && (
          <p className="text-sm text-red-600">
            {error instanceof Error ? error.message : 'Failed to load artifact'}
          </p>
        )}
        {artifact && tab === 'code' && (
          <pre className="overflow-x-auto rounded-lg bg-ink-900 p-4 text-xs text-ink-50">
            <code>{artifact.content}</code>
          </pre>
        )}
        {artifact && tab === 'preview' && (
          <>
            {artifact.type === 'html' || artifact.language === 'html' ? (
              <iframe
                title={artifact.title}
                sandbox=""
                referrerPolicy="no-referrer"
                srcDoc={buildSandboxHtml(artifact.content)}
                className="h-full min-h-[24rem] w-full rounded-lg border border-ink-200 bg-white"
              />
            ) : (
              <div className="markdown-body rounded-lg bg-white/80 p-4">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeSanitize]}
                >
                  {artifact.content}
                </ReactMarkdown>
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
