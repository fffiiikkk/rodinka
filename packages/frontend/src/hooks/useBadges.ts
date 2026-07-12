import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import type { UserBadge, BadgeProgress } from '@rodinkal/shared';

export function useMyBadges() {
  return useQuery({
    queryKey: ['badges', 'me'],
    queryFn: () => api.get<{ badges: UserBadge[] }>('/badges/me').then((r) => r.badges),
  });
}

export function useUnseenBadges() {
  return useQuery({
    queryKey: ['badges', 'unseen'],
    queryFn: () => api.get<{ badges: UserBadge[] }>('/badges/me/unseen').then((r) => r.badges),
    refetchInterval: 30_000, // poll every 30s for new badges
  });
}

export function useMarkBadgesSeen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/badges/me/mark-seen'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['badges', 'unseen'] });
      qc.invalidateQueries({ queryKey: ['badges', 'me'] });
    },
  });
}

export function useBadgeProgress() {
  return useQuery({
    queryKey: ['badges', 'progress'],
    queryFn: () => api.get<{ progress: BadgeProgress[] }>('/badges/me/progress').then((r) => r.progress),
    staleTime: 5 * 60_000,
  });
}
