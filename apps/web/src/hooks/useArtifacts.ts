import { useQuery } from '@tanstack/react-query';
import { isMockMode, listArtifacts } from '../lib/api';
import { mockApi } from '../lib/mock';

export const ARTIFACTS_KEY = ['artifacts'] as const;

export function useArtifacts(enabled = true) {
  return useQuery({
    queryKey: ARTIFACTS_KEY,
    queryFn: () => (isMockMode() ? mockApi.listArtifacts() : listArtifacts()),
    enabled,
  });
}
