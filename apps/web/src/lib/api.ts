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

export function clearUserId(): void {
  localStorage.removeItem(USER_ID_KEY);
}

function isUnknownUserError(message: string, status: number): boolean {
  if (status !== 401) return false;
  const m = message.toLowerCase();
  return (
    m.includes('unknown user') ||
    m.includes('invalid x-user-id') ||
    m.includes('missing x-user-id')
  );
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
  const err = new Error(message) as Error & { status?: number; code?: string };
  err.status = res.status;
  err.code = body?.error?.code;
  throw err;
}

let refreshUserPromise: Promise<string> | null = null;

/** Create a fresh anonymous user and persist it. Dedupes concurrent calls. */
export async function refreshAnonymousUser(): Promise<string> {
  if (!refreshUserPromise) {
    refreshUserPromise = (async () => {
      clearUserId();
      const headers = new Headers({ 'Content-Type': 'application/json' });
      const res = await fetch(`${API_BASE}/users/anonymous`, {
        method: 'POST',
        headers,
      });
      if (!res.ok) {
        await parseError(res);
      }
      const user = (await res.json()) as AnonymousUser;
      setUserId(user.id);
      return user.id;
    })().finally(() => {
      refreshUserPromise = null;
    });
  }
  return refreshUserPromise;
}

async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  retried = false,
): Promise<T> {
  const userId = getUserId();
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (userId) {
    headers.set('X-User-Id', userId);
  }

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    let body: ApiError | null = null;
    try {
      body = (await res.json()) as ApiError;
    } catch {
      /* empty */
    }
    const message =
      body?.error?.message ?? `Request failed with status ${res.status}`;

    // Stale localStorage user after DB reset — recreate and retry once
    if (
      !retried &&
      path !== '/users/anonymous' &&
      isUnknownUserError(message, res.status)
    ) {
      await refreshAnonymousUser();
      return apiFetch<T>(path, init, true);
    }

    const err = new Error(message) as Error & { status?: number; code?: string };
    err.status = res.status;
    err.code = body?.error?.code;
    throw err;
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

export async function createAnonymousUser(): Promise<AnonymousUser> {
  // Bypass auth header; always create a new row
  const res = await fetch(`${API_BASE}/users/anonymous`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    await parseError(res);
  }
  return (await res.json()) as AnonymousUser;
}

/** Validate stored user id; refresh if the DB no longer knows it. */
export async function ensureAnonymousUser(): Promise<string> {
  if (!getUserId()) {
    return refreshAnonymousUser();
  }
  try {
    // Any authenticated endpoint works as a ping.
    // apiFetch auto-recreates the user on 401 Unknown user.
    await apiFetch<Session[]>('/sessions');
    return getUserId() ?? refreshAnonymousUser();
  } catch {
    if (getUserId()) return getUserId()!;
    return refreshAnonymousUser();
  }
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

export async function streamMessage(
  sessionId: string,
  body: StreamRequest,
  signal?: AbortSignal,
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  let userId = getUserId();
  if (!userId) {
    userId = await refreshAnonymousUser();
  }
  headers['X-User-Id'] = userId;

  let res = await fetch(`${API_BASE}/sessions/${sessionId}/messages/stream`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok && res.status === 401) {
    let message = 'Unknown user.';
    try {
      const bodyJson = (await res.clone().json()) as ApiError;
      message = bodyJson?.error?.message ?? message;
    } catch {
      /* empty */
    }
    if (isUnknownUserError(message, res.status)) {
      userId = await refreshAnonymousUser();
      headers['X-User-Id'] = userId;
      res = await fetch(`${API_BASE}/sessions/${sessionId}/messages/stream`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal,
      });
    }
  }

  return res;
}
