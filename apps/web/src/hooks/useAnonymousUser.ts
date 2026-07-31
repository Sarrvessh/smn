import { useEffect, useState } from 'react';
import {
  ensureAnonymousUser,
  getUserId,
  isMockMode,
  setUserId,
} from '../lib/api';
import { mockApi } from '../lib/mock';
import { useUiStore } from '../stores/ui';

export function useAnonymousUser() {
  const [userId, setUserIdState] = useState<string | null>(() => getUserId());
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function ensureUser() {
      try {
        if (isMockMode()) {
          const existing = getUserId();
          if (existing) {
            if (!cancelled) {
              setUserIdState(existing);
              setIsReady(true);
            }
            return;
          }
          const user = await mockApi.createAnonymousUser();
          if (cancelled) return;
          setUserId(user.id);
          setUserIdState(user.id);
          setIsReady(true);
          return;
        }

        const previous = getUserId();
        // Validates stored id against the current DB; recreates if stale
        const id = await ensureAnonymousUser();
        if (cancelled) return;
        // If the anonymous user was recreated (e.g. after DB reset), drop
        // session selection that belonged to the old user.
        if (previous && previous !== id) {
          useUiStore.getState().setSelectedSessionId(null);
        }
        setUserIdState(id);
        setIsReady(true);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to create user');
          setIsReady(true);
        }
      }
    }

    void ensureUser();
    return () => {
      cancelled = true;
    };
  }, []);

  return { userId, isReady, error };
}