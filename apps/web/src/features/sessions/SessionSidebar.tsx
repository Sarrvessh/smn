import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Session } from '../../types/api';
import { useSessions } from '../../hooks/useSessions';
import { useUiStore, type ThemePreference } from '../../stores/ui';
import {
  IconLibrary,
  IconMore,
  IconMoon,
  IconPanel,
  IconPin,
  IconPlus,
  IconSearch,
  IconSidebar,
  IconSun,
  IconSystem,
} from '../../components/Icons';
import { BrandLockup } from '../../components/BrandLockup';
import { ArtifactsDialog } from './ArtifactsDialog';
import { LibraryDialog } from './LibraryDialog';
import { SessionSearchDialog } from './SessionSearchDialog';

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

function NavRow({
  collapsed,
  icon,
  label,
  onClick,
  title,
  active = false,
}: {
  collapsed: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
  title?: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium tracking-tight transition ${
        active
          ? 'bg-surface-active text-foreground'
          : 'text-foreground/90 hover:bg-surface-hover'
      } ${collapsed ? 'justify-center px-0' : ''}`}
      onClick={onClick}
      aria-label={label}
      title={title ?? label}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground">
        {icon}
      </span>
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  );
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
    isArchiving,
    restoreSession,
    isRestoring,
    archiveError,
    clearArchiveError,
  } = useSessions();
  const selectedSessionId = useUiStore((s) => s.selectedSessionId);
  const setSelectedSessionId = useUiStore((s) => s.setSelectedSessionId);
  const artifactPanelOpen = useUiStore((s) => s.artifactPanelOpen);
  const openArtifact = useUiStore((s) => s.openArtifact);
  const selectedArtifactId = useUiStore((s) => s.selectedArtifactId);
  const pinnedSessionIds = useUiStore((s) => s.pinnedSessionIds);
  const togglePinnedSession = useUiStore((s) => s.togglePinnedSession);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [artifactsOpen, setArtifactsOpen] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(
    null,
  );
  const [localArchiveError, setLocalArchiveError] = useState<string | null>(null);

  const pinnedSessions = useMemo(() => {
    const byId = new Map(sessions.map((s) => [s.id, s]));
    return pinnedSessionIds
      .map((id) => byId.get(id))
      .filter((s): s is Session => !!s);
  }, [sessions, pinnedSessionIds]);

  const recentSessions = useMemo(
    () => sessions.filter((s) => !pinnedSessionIds.includes(s.id)),
    [sessions, pinnedSessionIds],
  );

  const groups = useMemo(() => groupSessions(recentSessions), [recentSessions]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!menuId) return;
    const close = () => {
      setMenuId(null);
      setMenuPos(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [menuId]);

  const openMenu = (sessionId: string, anchor: HTMLElement) => {
    const rect = anchor.getBoundingClientRect();
    const menuWidth = 176;
    const menuHeight = 132;
    const left = Math.min(
      Math.max(8, rect.right - menuWidth),
      window.innerWidth - menuWidth - 8,
    );
    const openAbove = rect.bottom + menuHeight + 8 > window.innerHeight;
    const top = openAbove
      ? Math.max(8, rect.top - menuHeight - 4)
      : rect.bottom + 4;
    setMenuId(sessionId);
    setMenuPos({ top, left });
  };

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
    setMenuPos(null);
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
    setMenuPos(null);
    onNavigate?.();
  };

  const handleArchive = async (id: string) => {
    setMenuId(null);
    setMenuPos(null);
    setLocalArchiveError(null);
    clearArchiveError();
    try {
      await archiveSession(id);
      if (pinnedSessionIds.includes(id)) {
        togglePinnedSession(id);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not archive chat.';
      setLocalArchiveError(message);
    }
  };

  const menuSession = menuId
    ? sessions.find((s) => s.id === menuId) ?? null
    : null;
  const menuPinned = menuSession
    ? pinnedSessionIds.includes(menuSession.id)
    : false;
  const displayArchiveError = localArchiveError || archiveError;

  const renderSessionRow = (session: Session, showPinHint = false) => {
    const active = selectedSessionId === session.id;
    const menuOpen = menuId === session.id;
    const pinned = pinnedSessionIds.includes(session.id);

    if (editingId === session.id && !collapsed) {
      return (
        <li key={session.id}>
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
        </li>
      );
    }

    return (
      <li key={session.id}>
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
            {collapsed ? (
              session.title.slice(0, 1).toUpperCase()
            ) : (
              <span className="inline-flex max-w-full items-center gap-1.5">
                {showPinHint && pinned && (
                  <IconPin className="h-3 w-3 shrink-0 text-accent" />
                )}
                <span className="truncate">{session.title}</span>
              </span>
            )}
          </button>
          {!collapsed && (
            <button
              type="button"
              className="icon-button-quiet opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                if (menuOpen) {
                  setMenuId(null);
                  setMenuPos(null);
                } else {
                  openMenu(session.id, e.currentTarget);
                }
              }}
              aria-label={`Open actions for ${session.title}`}
              aria-expanded={menuOpen}
              title="Session actions"
              disabled={isArchiving}
            >
              <IconMore />
            </button>
          )}
        </div>
      </li>
    );
  };

  return (
    <aside
      className={`surface-panel flex h-full w-full flex-col border-r ${
        collapsed ? 'items-center' : ''
      }`}
      aria-label="Session sidebar"
    >
      <div className={`w-full border-b border-border ${collapsed ? 'px-2 py-3' : 'px-3 py-3'}`}>
        <div className={collapsed ? 'flex justify-center' : ''}>
          <BrandLockup compact={collapsed} />
        </div>
      </div>

      <div className={`w-full space-y-0.5 border-b border-border ${collapsed ? 'p-2' : 'p-2'}`}>
        <NavRow
          collapsed={collapsed}
          icon={<IconPlus className="h-4 w-4" />}
          label={isCreating ? 'Creating…' : 'New chat'}
          onClick={() => void handleNewChat()}
          title="New chat"
        />
        <NavRow
          collapsed={collapsed}
          icon={<IconSearch className="h-4 w-4" />}
          label="Search chats"
          onClick={() => setSearchOpen(true)}
          title="Search chats (Ctrl/⌘ K)"
        />
        <NavRow
          collapsed={collapsed}
          icon={<IconLibrary className="h-4 w-4" />}
          label="Library"
          onClick={() => setLibraryOpen(true)}
          title="Archived chats"
        />
        <NavRow
          collapsed={collapsed}
          icon={<IconPanel className="h-4 w-4" />}
          label="Artifacts"
          onClick={() => {
            setArtifactsOpen(true);
            onNavigate?.();
          }}
          title="All artifacts"
          active={artifactsOpen || artifactPanelOpen}
        />
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

        {pinnedSessions.length > 0 && (
          <div className="mb-3">
            {!collapsed && (
              <h2 className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Pinned
              </h2>
            )}
            <ul className="space-y-0.5">
              {pinnedSessions.map((session) => renderSessionRow(session, true))}
            </ul>
          </div>
        )}

        {!isLoading && recentSessions.length > 0 && (
          <div className="mb-1">
            {!collapsed && (
              <h2 className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Recents
              </h2>
            )}
          </div>
        )}

        {groups.map((group) => (
          <div key={group.label} className="mb-3">
            {!collapsed && (
              <h2 className="px-2 pb-1 text-[10px] font-medium tracking-tight text-muted-foreground">
                {group.label}
              </h2>
            )}
            <ul className="space-y-0.5">
              {group.items.map((session) => renderSessionRow(session))}
            </ul>
          </div>
        ))}
      </nav>

      {displayArchiveError && !collapsed && (
        <p
          className="mx-2 mb-2 rounded-lg border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-[11px] text-foreground"
          role="alert"
        >
          {displayArchiveError}
        </p>
      )}

      {menuSession && menuPos &&
        createPortal(
          <>
            <button
              type="button"
              className="fixed inset-0 z-40 cursor-default bg-transparent"
              aria-label="Close session menu"
              onClick={() => {
                setMenuId(null);
                setMenuPos(null);
              }}
            />
            <div
              className="surface-elevated fixed z-50 w-44 rounded-xl border border-border p-1 shadow-[var(--panel-shadow)]"
              style={{ top: menuPos.top, left: menuPos.left }}
              role="menu"
            >
              <p className="px-2 py-1 text-[10px] text-muted-foreground">
                Updated {formatDate(menuSession.updated_at)}
              </p>
              <button
                type="button"
                className="btn-ghost w-full justify-start gap-2"
                role="menuitem"
                onClick={() => {
                  togglePinnedSession(menuSession.id);
                  setMenuId(null);
                  setMenuPos(null);
                }}
              >
                <IconPin className="h-3.5 w-3.5" />
                {menuPinned ? 'Unpin' : 'Pin'}
              </button>
              <button
                type="button"
                className="btn-ghost w-full justify-start"
                role="menuitem"
                onClick={() => startRename(menuSession)}
              >
                Rename
              </button>
              <button
                type="button"
                className="btn-ghost w-full justify-start text-destructive hover:text-destructive"
                role="menuitem"
                disabled={isArchiving}
                onClick={() => void handleArchive(menuSession.id)}
              >
                {isArchiving ? 'Archiving…' : 'Archive'}
              </button>
            </div>
          </>,
          document.body,
        )}

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

      <SessionSearchDialog
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        sessions={sessions}
        isLoading={isLoading}
        selectedSessionId={selectedSessionId}
        onSelect={selectSession}
      />
      <LibraryDialog
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        onRestore={async (id) => {
          await restoreSession(id);
          onNavigate?.();
        }}
        isRestoring={isRestoring}
      />
      <ArtifactsDialog
        open={artifactsOpen}
        onClose={() => setArtifactsOpen(false)}
        selectedArtifactId={selectedArtifactId}
        onOpen={(item) => {
          setSelectedSessionId(item.session_id);
          openArtifact(item.id);
          setArtifactsOpen(false);
          onNavigate?.();
        }}
      />
    </aside>
  );
}
