import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import type { Event, CreateEventInput, UpdateEventInput } from '@rodinkal/shared';
import { format } from 'date-fns';

interface EventsResponse {
  events: Event[];
}

export function useEvents(from: Date, to: Date, opts?: { userId?: string; eventTypeId?: string }) {
  const params = new URLSearchParams({
    from: from.toISOString(),
    to: to.toISOString(),
    ...(opts?.userId ? { userId: opts.userId } : {}),
    ...(opts?.eventTypeId ? { eventTypeId: opts.eventTypeId } : {}),
  });

  return useQuery<Event[]>({
    queryKey: ['events', format(from, 'yyyy-MM-dd'), format(to, 'yyyy-MM-dd'), opts],
    queryFn: () => api.get<EventsResponse>(`/events?${params}`).then((r) => r.events),
    staleTime: 60_000,
  });
}

export function useProposals() {
  return useQuery({
    queryKey: ['events', 'proposals'],
    queryFn: () => api.get<{ proposals: Event[] }>('/events/proposals').then((r) => r.proposals),
  });
}

export function useEvent(id: string) {
  return useQuery({
    queryKey: ['events', id],
    queryFn: () => api.get<{ event: Event }>(`/events/${id}`).then((r) => r.event),
    enabled: !!id,
  });
}

export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateEventInput) => api.post<{ event: Event }>('/events', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['events'] }); },
  });
}

export function useUpdateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateEventInput }) =>
      api.patch<{ event: Event }>(`/events/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['events'] }); },
  });
}

export function useApproveEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/events/${id}/approve`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events'] });
      qc.invalidateQueries({ queryKey: ['badges'] });
    },
  });
}

export function useRejectEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/events/${id}/reject`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['events'] }); },
  });
}

export function useCancelEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/events/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['events'] }); },
  });
}

/** Create an exception for a single occurrence of a recurring event */
export function useCreateException() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ parentId, data }: { parentId: string; data: CreateEventInput }) =>
      api.post<{ event: Event }>(`/events/${parentId}/exception`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['events'] }); },
  });
}

/** Cancel a single occurrence (creates a CANCELLED exception placeholder) */
export function useCancelOccurrence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ parentId, date }: { parentId: string; date: string }) =>
      api.delete(`/events/${parentId}/occurrence/${date}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['events'] }); },
  });
}
