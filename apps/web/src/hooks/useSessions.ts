import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  archiveSession,
  createSession,
  isMockMode,
  listSessions,
  updateSession,
} from '../lib/api';
import { mockApi } from '../lib/mock';
import type { SessionCreate, SessionUpdate } from '../types/api';
import { useUiStore } from '../stores/ui';

const SESSIONS_KEY = ['sessions'] as const;

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
      void queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
      setSelectedSessionId(session.id);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: SessionUpdate }) =>
      isMockMode()
        ? mockApi.updateSession(id, body)
        : updateSession(id, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) =>
      isMockMode() ? mockApi.archiveSession(id) : archiveSession(id),
    onSuccess: (_data, archivedId) => {
      void queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
      if (selectedSessionId === archivedId) {
        setSelectedSessionId(null);
      }
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
  };
}
