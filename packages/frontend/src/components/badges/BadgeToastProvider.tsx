import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUnseenBadges, useMarkBadgesSeen } from '../../hooks/useBadges.js';
import type { UserBadge } from '@rodinkal/shared';
import { useAuth } from '../../hooks/useAuth.js';

interface BadgeToastContextValue {
  showBadge: (badge: UserBadge) => void;
}

const BadgeToastContext = createContext<BadgeToastContextValue | null>(null);

export function BadgeToastProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<UserBadge[]>([]);
  const [current, setCurrent] = useState<UserBadge | null>(null);
  const { isAuthenticated } = useAuth();
  const { data: unseenBadges } = useUnseenBadges();
  const markSeen = useMarkBadgesSeen();
  const shownIds = useRef(new Set<string>());

  // Show unseen badges from server
  useEffect(() => {
    if (!unseenBadges || !isAuthenticated) return;
    const newBadges = unseenBadges.filter((b) => !shownIds.current.has(b.id));
    if (newBadges.length > 0) {
      newBadges.forEach((b) => shownIds.current.add(b.id));
      setQueue((q) => [...q, ...newBadges]);
      void markSeen.mutateAsync();
    }
  }, [unseenBadges, isAuthenticated]);

  // Pop from queue
  useEffect(() => {
    if (current || queue.length === 0) return;
    const next = queue[0]!;
    setCurrent(next);
    setQueue((q) => q.slice(1));
    setTimeout(() => setCurrent(null), 4000);
  }, [queue, current]);

  const showBadge = (badge: UserBadge) => {
    shownIds.current.add(badge.id);
    setQueue((q) => [...q, badge]);
  };

  return (
    <BadgeToastContext.Provider value={{ showBadge }}>
      {children}
      <AnimatePresence>
        {current && (
          <motion.div
            key={current.id}
            initial={{ scale: 0, y: 40, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.8, y: -20, opacity: 0 }}
            transition={{ type: 'spring', damping: 16, stiffness: 300 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
          >
            <div className="card px-5 py-4 flex items-center gap-3 shadow-raised min-w-48 max-w-xs border-2 border-accent">
              <motion.span
                className="text-3xl"
                animate={{ rotate: [0, -10, 10, -5, 5, 0] }}
                transition={{ duration: 0.5, delay: 0.1 }}
              >
                {current.badge.icon}
              </motion.span>
              <div>
                <p className="text-xs font-semibold text-accent uppercase tracking-wide">Nový odznak!</p>
                <p className="font-bold text-ink">{current.badge.nameCs}</p>
                <p className="text-xs text-ink-muted">{current.badge.descriptionCs}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </BadgeToastContext.Provider>
  );
}

export function useBadgeToast() {
  return useContext(BadgeToastContext);
}
