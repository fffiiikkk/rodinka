import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { format } from 'date-fns';
import type { Availability, CreateAvailabilityInput } from '@rodinkal/shared';

export function useAvailability(from: Date, to: Date) {
  return useQuery<Availability[]>({
    queryKey: ['availability', format(from, 'yyyy-MM-dd'), format(to, 'yyyy-MM-dd')],
    queryFn: () =>
      api
        .get<{ items: Availability[] }>(
          `/availability?from=${from.toISOString()}&to=${to.toISOString()}`,
        )
        .then((r) => r.items),
    staleTime: 2 * 60_000,
  });
}

export function useCreateAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateAvailabilityInput & { userId?: string }) =>
      api.post<{ item: Availability }>('/availability', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['availability'] }),
  });
}

export function useUpdateAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<import('@rodinkal/shared').CreateAvailabilityInput> }) =>
      api.patch<{ item: Availability }>(`/availability/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['availability'] }),
  });
}

export function useDeleteAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/availability/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['availability'] }),
  });
}
