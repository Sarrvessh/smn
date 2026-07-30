import { useQuery } from '@tanstack/react-query';
import { getProvidersHealth, isMockMode } from '../lib/api';
import { mockApi } from '../lib/mock';

export function useProviders() {
  return useQuery({
    queryKey: ['providers'],
    queryFn: () =>
      isMockMode() ? mockApi.getProvidersHealth() : getProvidersHealth(),
    staleTime: 30_000,
  });
}
