import { useEffect, useMemo, useState } from 'react';
import type { Session } from '../../types/api';
import { useProviders } from '../../hooks/useProviders';
import { isEmbeddingModel, pickChatModel, providerState } from './providerUtils';

interface ProviderSelectorsProps {
  session: Session | null;
  onChange: (provider: string, model: string) => void;
}

export function ProviderSelectors({ session, onChange }: ProviderSelectorsProps) {
  const { data, isLoading, error } = useProviders();
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
  const state = providerState(activeProvider);

  const models = useMemo(() => {
    const raw = activeProvider?.models ?? [];
    const chatModels = raw.filter((m) => !isEmbeddingModel(m));
    return chatModels.length > 0 ? chatModels : raw;
  }, [activeProvider?.models]);

  // Heal invalid/missing chat models without fighting the user's selection.
  useEffect(() => {
    if (!sessionId || models.length === 0) return;
    if (model && models.includes(model) && !isEmbeddingModel(model)) return;
    const next = pickChatModel(models, model);
    if (next === model) return;
    setModel(next);
    onChange(provider, next);
  }, [sessionId, provider, models, model, onChange]);

  const handleProviderChange = (next: string) => {
    setProvider(next);
    const nextProvider = providers.find((p) => p.id === next);
    const rawModels = nextProvider?.models ?? [];
    const chatModels = rawModels.filter((m) => !isEmbeddingModel(m));
    const nextModel = pickChatModel(chatModels.length > 0 ? chatModels : rawModels);
    setModel(nextModel);
    onChange(next, nextModel);
  };

  const handleModelChange = (next: string) => {
    setModel(next);
    onChange(provider, next);
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
        <span className="status-dot warning" />
        <span>Checking providers</span>
        <div className="skeleton hidden h-8 w-28 sm:block" />
      </div>
    );
  }

  if (error || providers.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-2 text-xs text-destructive">
        <span className="status-dot unavailable" />
        <span>Provider status unavailable</span>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <div
        className="flex min-h-9 items-center gap-2 rounded-md border border-border bg-surface-elevated px-2.5 text-xs"
        title={state.label}
      >
        <span className={`status-dot ${state.className}`} aria-hidden="true" />
        <span className="hidden text-muted-foreground sm:inline">{state.detail}</span>
      </div>

      <label className="min-w-0">
        <span className="sr-only">LLM provider</span>
        <select
          value={provider}
          onChange={(e) => handleProviderChange(e.target.value)}
          className="select-field max-w-[8.5rem] sm:max-w-[10rem]"
          aria-label="LLM provider"
        >
          {providers.map((p) => {
            const pState = providerState(p);
            return (
              <option key={p.id} value={p.id} disabled={!pState.selectable}>
                {p.id} - {pState.detail}
              </option>
            );
          })}
        </select>
      </label>

      <label className="min-w-0">
        <span className="sr-only">Model</span>
        <select
          value={models.includes(model) ? model : pickChatModel(models, model)}
          onChange={(e) => handleModelChange(e.target.value)}
          className="select-field max-w-[9rem] sm:max-w-[13rem]"
          aria-label="Model"
          disabled={models.length === 0}
        >
          {models.length === 0 ? (
            <option value={model}>No chat model</option>
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
