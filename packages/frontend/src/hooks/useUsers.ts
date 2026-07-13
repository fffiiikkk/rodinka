import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';

export interface UserRow {
  id: string;
  name: string;
  nickname?: string | null;
  role: string;
  dateOfBirth?: string | null;
  relationship?: string | null;
  isActive: boolean;
}

/** All active users — used for admin selectors (participants, availability, etc.) */
export function useUsers() {
  return useQuery<UserRow[]>({
    queryKey: ['users', 'list'],
    queryFn: () =>
      api.get<{ items: UserRow[] }>('/users?pageSize=200').then((r) =>
        r.items.filter((u) => u.isActive),
      ),
    staleTime: 5 * 60_000,
  });
}

/** Only adult (non-KID) users */
export function useAdultUsers() {
  const q = useUsers();
  return {
    ...q,
    data: q.data?.filter((u) => u.role !== 'KID'),
  };
}
