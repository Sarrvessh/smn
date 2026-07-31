import type { ProviderInfo } from '../../types/api';

const PREFERRED_CHAT_MODELS = [
  'qwen2.5:7b',
  'qwen3:4b',
  'llama3.2:latest',
  'llama3.1:8b',
  'mistral:7b',
  'gemma:2b',
];

export function isEmbeddingModel(name: string): boolean {
  const n = name.toLowerCase();
  return (
    n.includes('embed') ||
    n.includes('nomic-embed') ||
    n.includes('embedding') ||
    n.startsWith('bge-') ||
    n.includes('minilm')
  );
}

export function pickChatModel(models: string[], current?: string): string {
  if (current && models.includes(current) && !isEmbeddingModel(current)) {
    return current;
  }
  for (const preferred of PREFERRED_CHAT_MODELS) {
    if (models.includes(preferred)) return preferred;
  }
  const chatOnly = models.filter((m) => !isEmbeddingModel(m));
  return chatOnly[0] ?? models[0] ?? 'qwen2.5:7b';
}

export function providerState(provider?: ProviderInfo | null) {
  if (!provider) {
    return {
      className: 'warning',
      label: 'Checking provider',
      detail: 'Checking',
      selectable: true,
    };
  }
  if (!provider.configured) {
    return {
      className: 'unavailable',
      label: `${provider.id} is not configured`,
      detail: 'Not configured',
      selectable: true,
    };
  }
  if (!provider.healthy) {
    return {
      className: 'unavailable',
      label: `${provider.id} is unavailable`,
      detail: 'Unavailable',
      selectable: true,
    };
  }
  if (provider.models.filter((m) => !isEmbeddingModel(m)).length === 0) {
    return {
      className: 'warning',
      label: `${provider.id} has no chat model`,
      detail: 'Missing model',
      selectable: true,
    };
  }
  return {
    className: 'healthy',
    label: `${provider.id} is healthy`,
    detail: 'Healthy',
    selectable: true,
  };
}
