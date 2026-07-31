import type {
  Artifact,
  ArtifactListItem,
  KnowledgeStatus,
  Message,
  ProvidersHealth,
  Session,
  SessionCreate,
  SessionUpdate,
  StreamRequest,
} from '../types/api';

export const API_BASE = '/api/v1';

export function isMockMode(): boolean {
  const flag = String(
    import.meta.env.VITE_USE_MOCK ?? import.meta.env.USE_MOCK ?? '',
  ).toLowerCase();
  return flag === 'true' || flag === '1' || flag === 'yes';
}

async function parseError(res: Response): Promise<never> {
  let message = `Request failed with status ${res.status}`;
  try {
    const body = (await res.json()) as {
      error?: { message?: string; code?: string };
    };
    message = body?.error?.message ?? message;
  } catch {
    /* empty */
  }
  throw new Error(message);
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    await parseError(res);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

export async function listSessions(opts?: {
  archived?: boolean;
}): Promise<Session[]> {
  const qs = opts?.archived ? '?archived=true' : '';
  return apiFetch<Session[]>(`/sessions${qs}`);
}

export async function createSession(body: SessionCreate): Promise<Session> {
  return apiFetch<Session>('/sessions', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getSession(sessionId: string): Promise<Session> {
  return apiFetch<Session>(`/sessions/${sessionId}`);
}

export async function updateSession(
  sessionId: string,
  body: SessionUpdate,
): Promise<Session> {
  return apiFetch<Session>(`/sessions/${sessionId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function archiveSession(sessionId: string): Promise<void> {
  await apiFetch<void>(`/sessions/${sessionId}`, { method: 'DELETE' });
}

export async function listMessages(sessionId: string): Promise<Message[]> {
  return apiFetch<Message[]>(`/sessions/${sessionId}/messages`);
}

export async function listArtifacts(): Promise<ArtifactListItem[]> {
  return apiFetch<ArtifactListItem[]>('/artifacts');
}

export async function getArtifact(artifactId: string): Promise<Artifact> {
  return apiFetch<Artifact>(`/artifacts/${artifactId}`);
}

export async function getProvidersHealth(): Promise<ProvidersHealth> {
  return apiFetch<ProvidersHealth>('/providers/health');
}

export async function getKnowledgeStatus(): Promise<KnowledgeStatus> {
  return apiFetch<KnowledgeStatus>('/knowledge/status');
}

export function streamMessage(
  sessionId: string,
  body: StreamRequest,
  signal?: AbortSignal,
): Promise<Response> {
  return fetch(`${API_BASE}/sessions/${sessionId}/messages/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
}
