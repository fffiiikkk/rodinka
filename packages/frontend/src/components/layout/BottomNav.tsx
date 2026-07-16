import React from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, Calendar, Users, User, Settings } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth.js';

export default function BottomNav() {
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) return null;

  const isAdmin = user?.role === 'PARENT';
  const isKid = user?.role === 'KID';

  // Max 5 links for comfortable mobile navigation
  const links = [
    { to: '/',         icon: LayoutDashboard, label: t('nav.dashboard') },
    { to: '/calendar', icon: Calendar,        label: t('nav.calendar') },
    // Kids & Guardians see "Přehled" (week overview); for parents add kids timeline
    ...(!isKid
      ? [{ to: '/kids-timeline', icon: Users, label: 'Děti' }]
      : []),
    { to: '/profile',  icon: User,            label: t('nav.profile') },
    // Admin gets a single "Admin" tab (covers reports + settings)
    ...(isAdmin
      ? [{ to: '/admin', icon: Settings, label: t('nav.admin') }]
      : []),
  ];

  return (
    <nav
      className="bottom-nav fixed bottom-0 left-0 right-0 z-30 bg-surface/90 backdrop-blur-xl border-t border-border/60"
      style={{ paddingBottom: 'var(--sab, 0px)' }}
    >
      {/* Thin top gradient accent */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

      <div className="flex items-stretch h-16 max-w-2xl mx-auto">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 relative group"
          >
            {({ isActive }) => (
              <>
                {/* Active pill background */}
                {isActive && (
                  <span className="absolute top-2 left-1/2 -translate-x-1/2 w-11 h-10 rounded-2xl bg-gradient-to-br from-primary/22 to-accent/12" />
                )}

                <Icon
                  size={22}
                  strokeWidth={isActive ? 2.5 : 1.7}
                  className={`relative z-10 transition-all duration-200 ${
                    isActive
                      ? 'text-primary scale-110 drop-shadow-sm'
                      : 'text-ink-faint group-hover:text-ink-muted group-hover:scale-105'
                  }`}
                />

                <span
                  className={`bottom-nav-label font-bold relative z-10 transition-colors duration-200 text-[10px] ${
                    isActive ? 'text-primary' : 'text-ink-faint group-hover:text-ink-muted'
                  }`}
                >
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
