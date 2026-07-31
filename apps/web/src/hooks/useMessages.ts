import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { isMockMode, listMessages } from '../lib/api';
import { mockApi } from '../lib/mock';
import type { Message } from '../types/api';

export function messagesKey(sessionId: string | null) {
  return ['messages', sessionId] as const;
}

export function useMessages(sessionId: string | null, enabled = true) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: messagesKey(sessionId),
    queryFn: () => {
      if (!sessionId) return Promise.resolve([] as Message[]);
      return isMockMode()
        ? mockApi.listMessages(sessionId)
        : listMessages(sessionId);
    },
    enabled: enabled && !!sessionId,
    placeholderData: keepPreviousData,
  });

  const setMessages = (updater: (prev: Message[]) => Message[]) => {
    if (!sessionId) return;
    queryClient.setQueryData<Message[]>(messagesKey(sessionId), (prev) =>
      updater(prev ?? []),
    );
  };

  const invalidate = () => {
    if (!sessionId) return;
    void queryClient.invalidateQueries({ queryKey: messagesKey(sessionId) });
  };

  return {
    messages: query.data ?? [],
    // Only treat as blocking load when we have nothing to show yet
    isLoading: query.isLoading && !query.data,
    isFetching: query.isFetching,
    error: query.error,
    setMessages,
    invalidate,
  };
}
