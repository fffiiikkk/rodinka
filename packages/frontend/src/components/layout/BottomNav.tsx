import React from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, Calendar, CalendarRange, User, Settings, BarChart2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth.js';

export default function BottomNav() {
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) return null;

  const isAdmin = user?.role === 'PARENT';

  const links = [
    { to: '/',        icon: LayoutDashboard, label: t('nav.dashboard') },
    { to: '/calendar', icon: Calendar,        label: t('nav.calendar') },
    { to: '/week',    icon: CalendarRange,    label: 'Týden' },
    { to: '/profile', icon: User,             label: t('nav.profile') },
    ...(isAdmin
      ? [
          { to: '/reports', icon: BarChart2, label: t('nav.reports') },
          { to: '/admin',   icon: Settings,  label: t('nav.admin') },
        ]
      : []),
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 bg-surface/90 backdrop-blur-xl border-t border-border/60"
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
                  <span className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-10 rounded-2xl bg-primary/12" />
                )}

                <Icon
                  size={22}
                  strokeWidth={isActive ? 2.5 : 1.7}
                  className={`relative z-10 transition-all duration-200 ${
                    isActive
                      ? 'text-primary scale-110'
                      : 'text-ink-faint group-hover:text-ink-muted group-hover:scale-105'
                  }`}
                />

                <span
                  className={`text-[10px] font-semibold relative z-10 transition-colors duration-200 ${
                    isActive ? 'text-primary' : 'text-ink-faint group-hover:text-ink-muted'
                  }`}
                >
                  {label}
                </span>

                {/* Active dot */}
                {isActive && (
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
