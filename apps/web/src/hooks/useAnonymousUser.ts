import { useEffect, useState } from 'react';
import {
  createAnonymousUser,
  getUserId,
  isMockMode,
  setUserId,
} from '../lib/api';
import { mockApi } from '../lib/mock';

export function useAnonymousUser() {
  const [userId, setUserIdState] = useState<string | null>(() => getUserId());
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function ensureUser() {
      const existing = getUserId();
      if (existing) {
        if (!cancelled) {
          setUserIdState(existing);
          setIsReady(true);
        }
        return;
      }

      try {
        const user = isMockMode()
          ? await mockApi.createAnonymousUser()
          : await createAnonymousUser();
        if (cancelled) return;
        setUserId(user.id);
        setUserIdState(user.id);
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
