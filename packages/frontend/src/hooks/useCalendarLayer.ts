import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { format } from 'date-fns';

export interface CalendarLayerEvent {
  id: string;
  type: 'birthday' | 'nameday';
  date: string;
  userId: string;
  userName: string;
  userPhotoUrl: string | null;
  userColor: string;
  label: string;
  age?: number;
  nameDayName?: string;
}

export function useCalendarLayer(from: Date, to: Date) {
  return useQuery<CalendarLayerEvent[]>({
    queryKey: ['calendar-layer', format(from, 'yyyy-MM-dd'), format(to, 'yyyy-MM-dd')],
    queryFn: () =>
      api
        .get<{ events: CalendarLayerEvent[] }>(
          `/calendar-layer?from=${from.toISOString()}&to=${to.toISOString()}`,
        )
        .then((r) => r.events),
    staleTime: 60 * 60_000, // 1 hour — birthday/nameday data is very stable
  });
}
