import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Trophy, UserX } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth.js';
import { useUnseenBadges } from '../../hooks/useBadges.js';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api.js';
import Avatar from '../ui/Avatar.js';

export default function TopBar() {
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuth();
  const { data: unseen } = useUnseenBadges();
  const qc = useQueryClient();

  if (!isAuthenticated) return null;

  const unseenCount = unseen?.length ?? 0;

  const stopImpersonation = async () => {
    await api.post('/users/impersonate/stop');
    await qc.invalidateQueries({ queryKey: ['auth', 'me'] });
    window.location.href = '/admin';
  };

  return (
    <header className="sticky top-0 z-30" style={{ paddingTop: 'var(--sat, 0px)' }}>
      {/* Impersonation banner */}
      {user?.isImpersonating && (
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold flex items-center justify-between px-4 py-2">
          <span>👤 Zobrazení jako: <strong>{user.name}</strong></span>
          <button
            onClick={stopImpersonation}
            className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 active:bg-white/40 px-3 py-1 rounded-full transition-colors font-semibold"
          >
            <UserX size={12} />
            Zpět na admin
          </button>
        </div>
      )}

      {/* Main bar — frosted glass */}
      <div className="bg-surface/90 backdrop-blur-xl relative">
        {/* Gradient bottom accent line */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <div className="flex items-center justify-between px-4 h-14 max-w-2xl mx-auto">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 select-none group">
            <div className="w-9 h-9 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center shadow-raised group-hover:scale-105 group-hover:shadow-raised transition-all">
              <span className="text-white text-base leading-none">📅</span>
            </div>
            <span className="hidden sm:block font-black text-base text-gradient tracking-tight">
              {t('app.name')}
            </span>
          </Link>

          {/* Actions */}
          <div className="flex items-center gap-1">
            {/* Badges */}
            <Link
              to="/badges"
              className="relative w-10 h-10 flex items-center justify-center rounded-xl text-ink-muted hover:text-primary hover:bg-primary/8 active:bg-primary/12 transition-all"
              title="Odznaky"
            >
              <Trophy size={20} strokeWidth={1.8} />
              {unseenCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-gradient-to-br from-red-500 to-rose-600 text-white text-[9px] rounded-full flex items-center justify-center font-black shadow-sm ring-1 ring-white dark:ring-surface">
                  {unseenCount > 9 ? '9+' : unseenCount}
                </span>
              )}
            </Link>

            {/* Avatar link */}
            <Link
              to="/profile"
              className="ml-1 rounded-xl hover:ring-2 hover:ring-primary/40 active:scale-95 transition-all"
            >
              {user && <Avatar name={user.name} photoUrl={user.photoUrl} size="sm" />}
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
