import type {
  AnonymousUser,
  ApiError,
  Artifact,
  KnowledgeStatus,
  Message,
  ProvidersHealth,
  Session,
  SessionCreate,
  SessionUpdate,
  StreamRequest,
} from '../types/api';

export const API_BASE = '/api/v1';
export const USER_ID_KEY = 'lenny_user_id';

export function isMockMode(): boolean {
  const flag = String(
    import.meta.env.VITE_USE_MOCK ?? import.meta.env.USE_MOCK ?? '',
  ).toLowerCase();
  return flag === 'true' || flag === '1' || flag === 'yes';
}

export function getUserId(): string | null {
  return localStorage.getItem(USER_ID_KEY);
}

export function setUserId(id: string): void {
  localStorage.setItem(USER_ID_KEY, id);
}

async function parseError(res: Response): Promise<never> {
  let body: ApiError | null = null;
  try {
    body = (await res.json()) as ApiError;
  } catch {
    /* empty */
  }
  const message =
    body?.error?.message ?? `Request failed with status ${res.status}`;
  throw new Error(message);
}

async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const userId = getUserId();
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (userId) {
    headers.set('X-User-Id', userId);
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

export async function createAnonymousUser(): Promise<AnonymousUser> {
  return apiFetch<AnonymousUser>('/users/anonymous', { method: 'POST' });
}

export async function listSessions(): Promise<Session[]> {
  return apiFetch<Session[]>('/sessions');
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
  const userId = getUserId();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (userId) {
    headers['X-User-Id'] = userId;
  }

  return fetch(`${API_BASE}/sessions/${sessionId}/messages/stream`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  });
}
