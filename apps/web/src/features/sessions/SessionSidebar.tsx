import { useMemo, useState } from 'react';
import type { Session } from '../../types/api';
import { useSessions } from '../../hooks/useSessions';
import { useUiStore, type ThemePreference } from '../../stores/ui';
import {
  IconMore,
  IconMoon,
  IconPlus,
  IconSidebar,
  IconSun,
  IconSystem,
} from '../../components/Icons';

interface SessionSidebarProps {
  collapsed: boolean;
  onCollapseChange: (collapsed: boolean) => void;
  onNavigate?: () => void;
  theme: ThemePreference;
  onCycleTheme: () => void;
}

function dayStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function groupSessions(sessions: Session[]) {
  const todayStart = dayStart(new Date());
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const weekAgo = new Date(todayStart);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const groups: { label: string; items: Session[] }[] = [
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'Previous 7 Days', items: [] },
    { label: 'Older', items: [] },
  ];

  for (const session of sessions) {
    const updated = new Date(session.updated_at);
    if (updated >= todayStart) {
      groups[0].items.push(session);
    } else if (updated >= yesterdayStart) {
      groups[1].items.push(session);
    } else if (updated >= weekAgo) {
      groups[2].items.push(session);
    } else {
      groups[3].items.push(session);
    }
  }

  return groups.filter((g) => g.items.length > 0);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
}

function ThemeIcon({ theme }: { theme: ThemePreference }) {
  if (theme === 'dark') return <IconMoon />;
  if (theme === 'light') return <IconSun />;
  return <IconSystem />;
}

export function SessionSidebar({
  collapsed,
  onCollapseChange,
  onNavigate,
  theme,
  onCycleTheme,
}: SessionSidebarProps) {
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
  const [menuId, setMenuId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return sessions;
    return sessions.filter((s) => s.title.toLowerCase().includes(query));
  }, [search, sessions]);

  const groups = useMemo(() => groupSessions(filtered), [filtered]);

  const handleNewChat = async () => {
    const session = await createSession({
      title: 'New chat',
      provider: 'ollama',
      model: 'qwen2.5:7b',
    });
    setSelectedSessionId(session.id);
    onNavigate?.();
  };

  const startRename = (session: Session) => {
    setMenuId(null);
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

  const selectSession = (id: string) => {
    setSelectedSessionId(id);
    setMenuId(null);
    onNavigate?.();
  };

  return (
    <aside
      className={`surface-panel flex h-full w-full flex-col border-r ${
        collapsed ? 'items-center' : ''
      }`}
      aria-label="Session sidebar"
    >
      <div className={`w-full border-b border-border ${collapsed ? 'px-2 py-3' : 'px-3 py-3'}`}>
        <div className={`flex items-center gap-2.5 ${collapsed ? 'justify-center' : ''}`}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-[10px] font-bold text-accent-foreground">
            LG
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="truncate text-[13px] font-semibold tracking-tight">
                Lenny Growth
              </h1>
              <p className="truncate text-[11px] text-muted-foreground">
                Research workspace
              </p>
            </div>
          )}
        </div>
      </div>

      <div className={`w-full space-y-2 border-b border-border ${collapsed ? 'p-2' : 'p-3'}`}>
        <button
          type="button"
          className={
            collapsed
              ? 'icon-button w-full bg-accent text-accent-foreground hover:opacity-90'
              : 'btn-primary w-full justify-start'
          }
          onClick={() => void handleNewChat()}
          disabled={isCreating}
          aria-label="New chat"
          title="New chat"
        >
          {collapsed ? (
            <IconPlus />
          ) : (
            <>
              <IconPlus className="h-3.5 w-3.5" />
              {isCreating ? 'Creating…' : 'New chat'}
            </>
          )}
        </button>
        {!collapsed && (
          <label className="block">
            <span className="sr-only">Search sessions</span>
            <input
              type="search"
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field"
              aria-label="Search sessions"
            />
          </label>
        )}
      </div>

      <nav
        className="scrollbar-stable min-h-0 w-full flex-1 overflow-y-auto px-2 py-2"
        aria-label="Chat sessions"
      >
        {isLoading && (
          <div className="space-y-2 px-1 py-2" aria-label="Loading sessions">
            <div className="skeleton h-8 w-full" />
            <div className="skeleton h-8 w-4/5" />
            <div className="skeleton h-8 w-full" />
          </div>
        )}

        {!isLoading && sessions.length === 0 && !collapsed && (
          <div className="px-2 py-4 text-[12px] text-muted-foreground">
            <p className="font-medium text-foreground">No chats yet</p>
            <p className="mt-1">Start a chat to keep research threads here.</p>
          </div>
        )}

        {!isLoading && sessions.length > 0 && filtered.length === 0 && !collapsed && (
          <div className="px-2 py-4 text-[12px] text-muted-foreground">
            <p className="font-medium text-foreground">No matching chats</p>
            <p className="mt-1">Try a shorter title search.</p>
          </div>
        )}

        {groups.map((group) => (
          <div key={group.label} className="mb-3">
            {!collapsed && (
              <h2 className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {group.label}
              </h2>
            )}
            <ul className="space-y-0.5">
              {group.items.map((session) => {
                const active = selectedSessionId === session.id;
                const menuOpen = menuId === session.id;
                return (
                  <li key={session.id} className="relative">
                    {editingId === session.id && !collapsed ? (
                      <input
                        className="input-field"
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
                        className={`group flex min-h-9 items-center gap-0.5 rounded-lg px-2 transition ${
                          active
                            ? 'bg-surface-active text-foreground'
                            : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground'
                        } ${collapsed ? 'justify-center' : ''}`}
                      >
                        <button
                          type="button"
                          className="min-w-0 flex-1 truncate text-left text-[13px] font-medium tracking-tight"
                          onClick={() => selectSession(session.id)}
                          aria-current={active ? 'page' : undefined}
                          title={session.title}
                        >
                          {collapsed
                            ? session.title.slice(0, 1).toUpperCase()
                            : session.title}
                        </button>
                        {!collapsed && (
                          <button
                            type="button"
                            className="icon-button-quiet opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
                            onClick={() => setMenuId(menuOpen ? null : session.id)}
                            aria-label={`Open actions for ${session.title}`}
                            aria-expanded={menuOpen}
                            title="Session actions"
                          >
                            <IconMore />
                          </button>
                        )}
                      </div>
                    )}

                    {menuOpen && !collapsed && (
                      <div className="surface-elevated absolute right-1 top-9 z-20 w-44 rounded-xl p-1">
                        <p className="px-2 py-1 text-[10px] text-muted-foreground">
                          Updated {formatDate(session.updated_at)}
                        </p>
                        <button
                          type="button"
                          className="btn-ghost w-full justify-start"
                          onClick={() => startRename(session)}
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          className="btn-ghost w-full justify-start text-destructive hover:text-destructive"
                          onClick={() => {
                            setMenuId(null);
                            void archiveSession(session.id);
                          }}
                        >
                          Archive
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className={`w-full border-t border-border ${collapsed ? 'p-2' : 'p-2.5'}`}>
        <div className={`flex items-center gap-1.5 ${collapsed ? 'flex-col' : ''}`}>
          <button
            type="button"
            className={collapsed ? 'icon-button' : 'btn-secondary flex-1 justify-start gap-2'}
            onClick={onCycleTheme}
            aria-label={`Theme: ${theme}`}
            title={`Theme: ${theme}`}
          >
            <ThemeIcon theme={theme} />
            {!collapsed && <span className="capitalize">{theme}</span>}
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={() => onCollapseChange(!collapsed)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <IconSidebar />
          </button>
        </div>
      </div>
    </aside>
  );
}
