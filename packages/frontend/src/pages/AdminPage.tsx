import React from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Users, Tag, ToggleLeft, MessageSquare, Flower2 } from 'lucide-react';
import UsersAdmin from '../components/admin/UsersAdmin.js';
import EventTypesAdmin from '../components/admin/EventTypesAdmin.js';
import FlagsAdmin from '../components/admin/FlagsAdmin.js';
import MotdAdmin from '../components/admin/MotdAdmin.js';
import NamedaysAdmin from '../components/admin/NamedaysAdmin.js';

export default function AdminPage() {
  const { t } = useTranslation();

  const links = [
    { to: '/admin', icon: Users, label: t('admin.users'), end: true },
    { to: '/admin/event-types', icon: Tag, label: t('admin.eventTypes') },
    { to: '/admin/flags', icon: ToggleLeft, label: t('admin.flags') },
    { to: '/admin/motd', icon: MessageSquare, label: t('admin.motd') },
    { to: '/admin/namedays', icon: Flower2, label: 'Jmeniny' },
  ];

  return (
    <div>
      <nav className="flex gap-1 px-4 py-3 overflow-x-auto scrollbar-none border-b border-border">
        {links.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                isActive ? 'bg-primary/10 text-primary' : 'text-ink-muted hover:text-ink'
              }`
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-4">
        <Routes>
          <Route index element={<UsersAdmin />} />
          <Route path="event-types" element={<EventTypesAdmin />} />
          <Route path="flags" element={<FlagsAdmin />} />
          <Route path="motd" element={<MotdAdmin />} />
          <Route path="namedays" element={<NamedaysAdmin />} />
        </Routes>
      </div>
    </div>
  );
}
