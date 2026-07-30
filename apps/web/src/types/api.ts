export type ChatMode = 'auto' | 'transcript_qa' | 'ship30_essay' | 'artifact';

export type MessageStatus =
  | 'pending'
  | 'streaming'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface ApiError {
  error: {
    code: string;
    message: string;
    retryable: boolean;
    request_id?: string;
  };
}

export interface AnonymousUser {
  id: string;
  created_at: string;
}

export interface Session {
  id: string;
  title: string;
  provider: string;
  model: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface SessionCreate {
  title?: string;
  provider?: string;
  model?: string;
}

export interface SessionUpdate {
  title?: string;
  provider?: string;
  model?: string;
  archived?: boolean;
}

export interface Source {
  citation_label: string;
  rank: number;
  guest: string | null;
  episode: string | null;
  excerpt: string | null;
  url: string | null;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | string;
  content: string;
  status: MessageStatus;
  skill: string | null;
  provider: string | null;
  model: string | null;
  latency_ms: number | null;
  error_code: string | null;
  created_at: string;
  sources: Source[];
}

export interface StreamRequest {
  content: string;
  mode: ChatMode;
  provider?: string;
  model?: string;
}

export interface Artifact {
  id: string;
  session_id: string;
  message_id: string;
  type: 'markdown' | 'html' | string;
  title: string;
  content: string;
  language: string;
  created_at: string;
}

export interface ProviderInfo {
  id: string;
  configured: boolean;
  healthy: boolean;
  models: string[];
}

export interface ProvidersHealth {
  providers: ProviderInfo[];
}

export interface KnowledgeStatus {
  episodes: number;
  chunks: number;
  ready: boolean;
  embedding_dim: number | null;
}

export type StreamStage =
  | 'routing'
  | 'retrieving'
  | 'generating'
  | 'validating'
  | 'saving';

export interface StreamSource {
  id: string;
  guest: string;
  episode: string;
  excerpt: string;
  url: string;
  publish_date: string | null;
}

export interface RunStartedEvent {
  event: 'run_started';
  run_id: string;
  message_id: string;
}

export interface StatusEvent {
  event: 'status';
  stage: StreamStage;
  label: string;
}

export interface SourcesEvent {
  event: 'sources';
  sources: StreamSource[];
}

export interface TokenEvent {
  event: 'token';
  text: string;
}

export interface ContentReplaceEvent {
  event: 'content_replace';
  text: string;
}

export interface ArtifactEvent {
  event: 'artifact';
  artifact_id: string;
  type: string;
  title: string;
}

export interface CompletedEvent {
  event: 'completed';
  message_id: string;
  skill: string;
  latency_ms: number;
}

export interface ErrorEvent {
  event: 'error';
  code: string;
  message: string;
  retryable: boolean;
}

export type StreamEvent =
  | RunStartedEvent
  | StatusEvent
  | SourcesEvent
  | TokenEvent
  | ContentReplaceEvent
  | ArtifactEvent
  | CompletedEvent
  | ErrorEvent;

export const MODE_LABELS: Record<ChatMode, string> = {
  auto: 'Auto',
  transcript_qa: 'Ask Lenny',
  ship30_essay: 'Ship30 Essay',
  artifact: 'Create Artifact',
};

export const SUGGESTED_PROMPTS = [
  "What patterns do Lenny's guests recommend for finding product-market fit?",
  'Compare onboarding advice across multiple guests.',
  'Turn this answer into a Ship30for30 essay.',
  'Create an HTML growth strategy dashboard from this discussion.',
];
