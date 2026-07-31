import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  archiveSession,
  createSession,
  isMockMode,
  listSessions,
  updateSession,
} from '../lib/api';
import { mockApi } from '../lib/mock';
import type { Session, SessionCreate, SessionUpdate } from '../types/api';
import { useUiStore } from '../stores/ui';

const SESSIONS_KEY = ['sessions'] as const;
export const ARCHIVED_SESSIONS_KEY = ['sessions', 'archived'] as const;

export function useSessions(enabled = true) {
  const queryClient = useQueryClient();
  const setSelectedSessionId = useUiStore((s) => s.setSelectedSessionId);
  const selectedSessionId = useUiStore((s) => s.selectedSessionId);

  const query = useQuery({
    queryKey: SESSIONS_KEY,
    queryFn: () =>
      isMockMode() ? mockApi.listSessions() : listSessions(),
    enabled,
  });

  const createMutation = useMutation({
    mutationFn: (body: SessionCreate = {}) =>
      isMockMode() ? mockApi.createSession(body) : createSession(body),
    onSuccess: (session) => {
      queryClient.setQueryData<Session[]>(SESSIONS_KEY, (prev) => {
        const list = prev ?? [];
        if (list.some((s) => s.id === session.id)) return list;
        return [session, ...list];
      });
      setSelectedSessionId(session.id);
      void queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: SessionUpdate }) =>
      isMockMode()
        ? mockApi.updateSession(id, body)
        : updateSession(id, body),
    onSuccess: (session) => {
      queryClient.setQueryData<Session[]>(SESSIONS_KEY, (prev) =>
        (prev ?? []).map((s) =>
          s.id === session.id
            ? {
                ...s,
                title: session.title,
                provider: session.provider,
                model: session.model,
                archived_at: session.archived_at,
                updated_at: session.updated_at ?? s.updated_at,
              }
            : s,
        ),
      );
      void queryClient.invalidateQueries({ queryKey: ARCHIVED_SESSIONS_KEY });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) =>
      isMockMode() ? mockApi.archiveSession(id) : archiveSession(id),
    onMutate: async (archivedId) => {
      await queryClient.cancelQueries({ queryKey: SESSIONS_KEY });
      const previous = queryClient.getQueryData<Session[]>(SESSIONS_KEY) ?? [];
      const next = previous.filter((s) => s.id !== archivedId);
      queryClient.setQueryData<Session[]>(SESSIONS_KEY, next);

      if (selectedSessionId === archivedId) {
        setSelectedSessionId(next[0]?.id ?? null);
      }
      return { previous };
    },
    onError: (_err, _archivedId, context) => {
      if (context?.previous) {
        queryClient.setQueryData<Session[]>(SESSIONS_KEY, context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
      void queryClient.invalidateQueries({ queryKey: ARCHIVED_SESSIONS_KEY });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) =>
      isMockMode()
        ? mockApi.updateSession(id, { archived: false })
        : updateSession(id, { archived: false }),
    onSuccess: (session) => {
      queryClient.setQueryData<Session[]>(ARCHIVED_SESSIONS_KEY, (prev) =>
        (prev ?? []).filter((s) => s.id !== session.id),
      );
      queryClient.setQueryData<Session[]>(SESSIONS_KEY, (prev) => {
        const list = prev ?? [];
        if (list.some((s) => s.id === session.id)) return list;
        return [{ ...session, archived_at: null }, ...list];
      });
      setSelectedSessionId(session.id);
      void queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
      void queryClient.invalidateQueries({ queryKey: ARCHIVED_SESSIONS_KEY });
    },
  });

  return {
    sessions: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    createSession: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    renameSession: (id: string, title: string) =>
      updateMutation.mutateAsync({ id, body: { title } }),
    updateSession: (id: string, body: SessionUpdate) =>
      updateMutation.mutateAsync({ id, body }),
    archiveSession: archiveMutation.mutateAsync,
    isArchiving: archiveMutation.isPending,
    restoreSession: restoreMutation.mutateAsync,
    isRestoring: restoreMutation.isPending,
    archiveError:
      archiveMutation.error instanceof Error
        ? archiveMutation.error.message
        : archiveMutation.error
          ? 'Could not archive chat.'
          : null,
    clearArchiveError: () => archiveMutation.reset(),
  };
}

export function useArchivedSessions(enabled = false) {
  return useQuery({
    queryKey: ARCHIVED_SESSIONS_KEY,
    queryFn: () =>
      isMockMode()
        ? mockApi.listSessions({ archived: true })
        : listSessions({ archived: true }),
    enabled,
  });
}
