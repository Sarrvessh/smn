import type {
  AnonymousUser,
  Artifact,
  Message,
  ProvidersHealth,
  Session,
} from '../types/api';

const MOCK_USER: AnonymousUser = {
  id: '00000000-0000-4000-8000-000000000001',
  created_at: new Date().toISOString(),
};

let mockSessions: Session[] = [
  {
    id: '10000000-0000-4000-8000-000000000001',
    title: 'Product-market fit patterns',
    provider: 'ollama',
    model: 'qwen2.5:7b',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    archived_at: null,
  },
];

const mockMessages: Record<string, Message[]> = {
  '10000000-0000-4000-8000-000000000001': [
    {
      id: '20000000-0000-4000-8000-000000000001',
      role: 'user',
      content: "What do Lenny's guests say about product-market fit?",
      status: 'completed',
      skill: null,
      provider: 'ollama',
      model: 'qwen2.5:7b',
      latency_ms: null,
      error_code: null,
      created_at: new Date().toISOString(),
      sources: [],
    },
    {
      id: '20000000-0000-4000-8000-000000000002',
      role: 'assistant',
      content:
        'Lenny\'s guests often describe product-market fit as a phase where retention curves flatten and organic growth accelerates. [S1]',
      status: 'completed',
      skill: 'transcript_qa',
      provider: 'ollama',
      model: 'qwen2.5:7b',
      latency_ms: 3200,
      error_code: null,
      created_at: new Date().toISOString(),
      sources: [
        {
          citation_label: 'S1',
          rank: 1,
          guest: 'Sample Guest',
          episode: 'Finding PMF',
          excerpt: 'When retention flattens, you know you have something real.',
          url: 'https://youtube.com/watch?v=example',
        },
      ],
    },
  ],
};

const mockArtifacts: Record<string, Artifact> = {};

export const mockApi = {
  createAnonymousUser(): Promise<AnonymousUser> {
    return Promise.resolve(MOCK_USER);
  },

  listSessions(): Promise<Session[]> {
    return Promise.resolve([...mockSessions]);
  },

  createSession(body: Partial<Session>): Promise<Session> {
    const session: Session = {
      id: crypto.randomUUID(),
      title: body.title ?? 'New chat',
      provider: body.provider ?? 'ollama',
      model: body.model ?? 'qwen2.5:7b',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      archived_at: null,
    };
    mockSessions = [session, ...mockSessions];
    mockMessages[session.id] = [];
    return Promise.resolve(session);
  },

  updateSession(
    id: string,
    body: Partial<Session> & { archived?: boolean },
  ): Promise<Session> {
    mockSessions = mockSessions.map((s) => {
      if (s.id !== id) return s;
      const archived_at =
        body.archived === true
          ? new Date().toISOString()
          : body.archived === false
            ? null
            : body.archived_at ?? s.archived_at;
      return {
        ...s,
        ...body,
        archived_at,
        updated_at: new Date().toISOString(),
      };
    });
    const session = mockSessions.find((s) => s.id === id);
    if (!session) throw new Error('Session not found');
    return Promise.resolve(session);
  },

  archiveSession(id: string): Promise<void> {
    mockSessions = mockSessions.filter((s) => s.id !== id);
    return Promise.resolve();
  },

  listMessages(sessionId: string): Promise<Message[]> {
    return Promise.resolve(mockMessages[sessionId] ?? []);
  },

  getArtifact(id: string): Promise<Artifact> {
    const art = mockArtifacts[id];
    if (!art) throw new Error('Artifact not found');
    return Promise.resolve(art);
  },

  getProvidersHealth(): Promise<ProvidersHealth> {
    return Promise.resolve({
      providers: [
        {
          id: 'ollama',
          configured: true,
          healthy: true,
          models: ['qwen2.5:7b'],
        },
        {
          id: 'anthropic',
          configured: false,
          healthy: false,
          models: [],
        },
      ],
    });
  },
};

export function registerMockArtifact(artifact: Artifact): void {
  mockArtifacts[artifact.id] = artifact;
}

export function appendMockMessage(sessionId: string, message: Message): void {
  if (!mockMessages[sessionId]) mockMessages[sessionId] = [];
  mockMessages[sessionId].push(message);
}

export function updateMockMessage(
  sessionId: string,
  messageId: string,
  patch: Partial<Message>,
): void {
  const list = mockMessages[sessionId];
  if (!list) return;
  const idx = list.findIndex((m) => m.id === messageId);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...patch };
  }
}
