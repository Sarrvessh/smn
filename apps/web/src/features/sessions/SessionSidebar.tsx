import { useState } from 'react';
import type { Session } from '../../types/api';
import { useSessions } from '../../hooks/useSessions';
import { useUiStore } from '../../stores/ui';

function groupSessions(sessions: Session[]) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(todayStart);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const groups: { label: string; items: Session[] }[] = [
    { label: 'Today', items: [] },
    { label: 'Previous 7 Days', items: [] },
    { label: 'Older', items: [] },
  ];

  for (const session of sessions) {
    const updated = new Date(session.updated_at);
    if (updated >= todayStart) {
      groups[0].items.push(session);
    } else if (updated >= weekAgo) {
      groups[1].items.push(session);
    } else {
      groups[2].items.push(session);
    }
  }

  return groups.filter((g) => g.items.length > 0);
}

export function SessionSidebar() {
  const {
    sessions,
    isLoading,
    createSession,
    isCreating,
    renameSession,
    archiveSession,
  } = useSessions();
  const selectedSessionId = useUiStore((s) => s.selectedSessionId);
  const setSelectedSessionId = useUiStore((s) => s.setSelectedSessionId);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [search, setSearch] = useState('');

  const filtered = sessions.filter((s) =>
    s.title.toLowerCase().includes(search.toLowerCase()),
  );
  const groups = groupSessions(filtered);

  const handleNewChat = async () => {
    await createSession({
      title: 'New chat',
      provider: 'ollama',
      model: 'qwen2.5:7b',
    });
  };

  const startRename = (session: Session) => {
    setEditingId(session.id);
    setEditTitle(session.title);
  };

  const commitRename = async (id: string) => {
    const trimmed = editTitle.trim();
    if (trimmed) {
      await renameSession(id, trimmed);
    }
    setEditingId(null);
  };

  return (
    <aside className="flex h-full w-full flex-col panel border-r-0 lg:border-r">
      <div className="border-b border-ink-200/60 px-4 py-4">
        <h1 className="text-base font-bold tracking-tight text-ink-900">
          Lenny Growth Assistant
        </h1>
        <p className="mt-0.5 text-xs text-ink-500">Product research workspace</p>
      </div>

      <div className="p-3">
        <button
          type="button"
          className="btn-primary w-full"
          onClick={() => void handleNewChat()}
          disabled={isCreating}
        >
          New Chat
        </button>
        <input
          type="search"
          placeholder="Search sessions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field mt-2"
          aria-label="Search sessions"
        />
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-4" aria-label="Chat sessions">
        {isLoading && (
          <p className="px-2 py-4 text-sm text-ink-500">Loading sessions...</p>
        )}
        {!isLoading && filtered.length === 0 && (
          <p className="px-2 py-4 text-sm text-ink-500">
            No sessions yet. Start a new chat.
          </p>
        )}
        {groups.map((group) => (
          <div key={group.label} className="mb-3">
            <h2 className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-ink-400">
              {group.label}
            </h2>
            <ul className="space-y-0.5">
              {group.items.map((session) => (
                <li key={session.id}>
                  {editingId === session.id ? (
                    <input
                      className="input-field mx-1"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onBlur={() => void commitRename(session.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void commitRename(session.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      autoFocus
                      aria-label="Rename session"
                    />
                  ) : (
                    <div
                      className={`group flex items-center gap-1 rounded-lg px-2 py-1.5 ${
                        selectedSessionId === session.id
                          ? 'bg-accent-light text-accent'
                          : 'hover:bg-ink-50'
                      }`}
                    >
                      <button
                        type="button"
                        className="min-w-0 flex-1 truncate text-left text-sm"
                        onClick={() => setSelectedSessionId(session.id)}
                      >
                        {session.title}
                      </button>
                      <div className="flex shrink-0 gap-0.5 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                        <button
                          type="button"
                          className="rounded p-1 text-xs text-ink-500 hover:bg-white hover:text-ink-800"
                          onClick={() => startRename(session)}
                          aria-label={`Rename ${session.title}`}
                          title="Rename"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="rounded p-1 text-xs text-ink-500 hover:bg-white hover:text-red-700"
                          onClick={() => void archiveSession(session.id)}
                          aria-label={`Archive ${session.title}`}
                          title="Archive"
                        >
                          Archive
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
