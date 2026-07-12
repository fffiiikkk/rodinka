import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { api } from '../lib/api.js';
import type { UserPublic, FeatureFlagsMap } from '@rodinkal/shared';
import i18n from '../i18n/index.js';

interface AuthResponse {
  user: UserPublic;
  flags: FeatureFlagsMap;
}

export function useAuth() {
  const qc = useQueryClient();

  const { data, isLoading, isError } = useQuery<AuthResponse>({
    queryKey: ['auth', 'me'],
    queryFn: () => api.get<AuthResponse>('/auth/me'),
    retry: false,
    staleTime: 5 * 60_000,
  });

  const loginMutation = useMutation({
    mutationFn: (creds: { username: string; password: string }) =>
      api.post<AuthResponse>('/auth/login', creds),
    onSuccess: (data) => {
      qc.setQueryData(['auth', 'me'], data);
      // Apply user's language preference
      if (data.user.preferredLanguage) {
        void i18n.changeLanguage(data.user.preferredLanguage.toLowerCase());
      }
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => api.post('/auth/logout'),
    // Clear auth data immediately so the UI redirects to /login without waiting
    // for the network round-trip. The backend call still runs to destroy the session.
    onMutate: () => {
      qc.setQueryData(['auth', 'me'], null);
      qc.cancelQueries();
    },
    onSettled: () => {
      qc.clear();
    },
  });

  // Handle session expiry events from api.ts
  useEffect(() => {
    const handler = () => qc.setQueryData(['auth', 'me'], null);
    window.addEventListener('session-expired', handler);
    return () => window.removeEventListener('session-expired', handler);
  }, [qc]);

  // Sync language when user loads
  useEffect(() => {
    if (data?.user.preferredLanguage) {
      void i18n.changeLanguage(data.user.preferredLanguage.toLowerCase());
    }
  }, [data?.user.preferredLanguage]);

  return {
    user: data?.user ?? null,
    flags: data?.flags ?? null,
    isLoading,
    isAuthenticated: !!data?.user,
    isError,
    login: loginMutation.mutateAsync,
    // Use mutate (fire-and-forget) — UI redirects immediately via onMutate
    logout: () => logoutMutation.mutate(),
    loginError: loginMutation.error,
    isLoggingIn: loginMutation.isPending,
  };
}

export function useFlags() {
  const { data } = useQuery<AuthResponse>({
    queryKey: ['auth', 'me'],
    enabled: false, // only reads cached data
  });
  return data?.flags ?? {} as Partial<FeatureFlagsMap>;
}
