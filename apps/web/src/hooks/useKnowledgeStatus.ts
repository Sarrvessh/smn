import { useQuery } from '@tanstack/react-query';
import { getKnowledgeStatus, isMockMode } from '../lib/api';
import { mockApi } from '../lib/mock';

export function useKnowledgeStatus() {
  return useQuery({
    queryKey: ['knowledge-status'],
    queryFn: () =>
      isMockMode() ? mockApi.getKnowledgeStatus() : getKnowledgeStatus(),
    staleTime: 30_000,
  });
}
