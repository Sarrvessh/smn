import { useEffect, useMemo, useState } from 'react';
import type { Session } from '../../types/api';
import { useProviders } from '../../hooks/useProviders';

interface ProviderSelectorsProps {
  session: Session | null;
  onChange: (provider: string, model: string) => void;
}

const PREFERRED_CHAT_MODELS = [
  'qwen2.5:7b',
  'qwen3:4b',
  'llama3.2:latest',
  'llama3.1:8b',
  'mistral:7b',
  'gemma:2b',
];

function isEmbeddingModel(name: string): boolean {
  const n = name.toLowerCase();
  return (
    n.includes('embed') ||
    n.includes('nomic-embed') ||
    n.includes('embedding') ||
    n.startsWith('bge-') ||
    n.includes('minilm')
  );
}

function pickChatModel(models: string[], current?: string): string {
  if (current && models.includes(current) && !isEmbeddingModel(current)) {
    return current;
  }
  for (const preferred of PREFERRED_CHAT_MODELS) {
    if (models.includes(preferred)) return preferred;
  }
  const chatOnly = models.filter((m) => !isEmbeddingModel(m));
  return chatOnly[0] ?? models[0] ?? 'qwen2.5:7b';
}

export function ProviderSelectors({ session, onChange }: ProviderSelectorsProps) {
  const { data, isLoading } = useProviders();
  const providers = data?.providers ?? [];

  const [provider, setProvider] = useState(session?.provider ?? 'ollama');
  const [model, setModel] = useState(session?.model ?? 'qwen2.5:7b');

  const sessionId = session?.id;
  const sessionProvider = session?.provider;
  const sessionModel = session?.model;

  useEffect(() => {
    if (sessionProvider && sessionModel) {
      setProvider(sessionProvider);
      setModel(sessionModel);
    }
  }, [sessionId, sessionProvider, sessionModel]);

  const activeProvider = providers.find((p) => p.id === provider);
  const models = useMemo(() => {
    const raw = activeProvider?.models ?? [];
    const chatModels = raw.filter((m) => !isEmbeddingModel(m));
    return chatModels.length > 0 ? chatModels : raw;
  }, [activeProvider?.models]);

  useEffect(() => {
    if (models.length === 0) return;
    const next = pickChatModel(models, model);
    if (next !== model) {
      setModel(next);
      onChange(provider, next);
    }
  }, [provider, models, model, onChange]);

  const handleProviderChange = (next: string) => {
    setProvider(next);
    const nextProvider = providers.find((p) => p.id === next);
    const nextModels = (nextProvider?.models ?? []).filter((m) => !isEmbeddingModel(m));
    const nextModel = pickChatModel(
      nextModels.length > 0 ? nextModels : nextProvider?.models ?? [],
    );
    setModel(nextModel);
    onChange(next, nextModel);
  };

  const handleModelChange = (next: string) => {
    setModel(next);
    onChange(provider, next);
  };

  if (isLoading) {
    return <span className="text-xs text-ink-500">Loading providers...</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-1.5 text-xs text-ink-600">
        <span className="sr-only">Provider</span>
        <select
          value={provider}
          onChange={(e) => handleProviderChange(e.target.value)}
          className="rounded-md border border-ink-200 bg-white/90 px-2 py-1 text-xs text-ink-800 focus:border-accent focus:outline-none"
          aria-label="LLM provider"
        >
          {providers.map((p) => (
            <option key={p.id} value={p.id} disabled={!p.configured}>
              {p.id}
              {!p.healthy && p.configured ? ' (unhealthy)' : ''}
              {!p.configured ? ' (not configured)' : ''}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-1.5 text-xs text-ink-600">
        <span className="sr-only">Model</span>
        <select
          value={models.includes(model) ? model : pickChatModel(models, model)}
          onChange={(e) => handleModelChange(e.target.value)}
          className="rounded-md border border-ink-200 bg-white/90 px-2 py-1 text-xs text-ink-800 focus:border-accent focus:outline-none"
          aria-label="Model"
          disabled={models.length === 0}
        >
          {models.length === 0 ? (
            <option value={model}>{model}</option>
          ) : (
            models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))
          )}
        </select>
      </label>
    </div>
  );
}
