import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { isMockMode, listMessages } from '../lib/api';
import { mockApi } from '../lib/mock';
import type { Message } from '../types/api';

export function messagesKey(sessionId: string | null) {
  return ['messages', sessionId] as const;
}

/** Keep user turns before assistant when timestamps collide. */
export function sortMessages(messages: Message[]): Message[] {
  return [...messages].sort((a, b) => {
    const ta = Date.parse(a.created_at) || 0;
    const tb = Date.parse(b.created_at) || 0;
    if (ta !== tb) return ta - tb;
    if (a.role !== b.role) {
      if (a.role === 'user') return -1;
      if (b.role === 'user') return 1;
    }
    return a.id.localeCompare(b.id);
  });
}

export function useMessages(sessionId: string | null, enabled = true) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: messagesKey(sessionId),
    queryFn: async () => {
      if (!sessionId) return [] as Message[];
      const rows = isMockMode()
        ? await mockApi.listMessages(sessionId)
        : await listMessages(sessionId);
      return sortMessages(rows);
    },
    enabled: enabled && !!sessionId,
    placeholderData: keepPreviousData,
  });

  const setMessages = (updater: (prev: Message[]) => Message[]) => {
    if (!sessionId) return;
    queryClient.setQueryData<Message[]>(messagesKey(sessionId), (prev) =>
      sortMessages(updater(prev ?? [])),
    );
  };

  const invalidate = () => {
    if (!sessionId) return;
    void queryClient.invalidateQueries({ queryKey: messagesKey(sessionId) });
  };

  return {
    messages: sortMessages(query.data ?? []),
    // Only treat as blocking load when we have nothing to show yet
    isLoading: query.isLoading && !query.data,
    isFetching: query.isFetching,
    error: query.error,
    setMessages,
    invalidate,
  };
}
