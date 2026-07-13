import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useMyBadges, useBadgeProgress } from '../hooks/useBadges.js';
import { api } from '../lib/api.js';
import type { BadgeDefinition, UserBadge, BadgeProgress } from '@rodinkal/shared';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock, CheckCircle2, Trophy, Flame, Hash, Zap } from 'lucide-react';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';

// ─── Human-readable rule descriptions ───────────────────────────────────────
function ruleDescription(badge: BadgeDefinition): string {
  const { ruleType, metric, threshold } = badge;

  // Participation-based (athlete/family member at the event)
  if (metric.startsWith('EVENT_PARTICIPATED_')) {
    const slug = metric.replace('EVENT_PARTICIPATED_', '').replace(/-/g, ' ');
    if (ruleType === 'FIRST')  return `Zúčastni se svého prvního: ${slug}.`;
    if (ruleType === 'COUNT')  return `Zúčastni se celkem ${threshold}× aktivity: ${slug}.`;
    return `${threshold}× účast na: ${slug}.`;
  }

  // Transport-based (driver)
  if (metric === 'TRANSPORT_COUNT') {
    if (ruleType === 'FIRST')  return `Poprvé odveď dítě na aktivitu.`;
    if (ruleType === 'COUNT')  return `Odveď dítě na aktivitu celkem ${threshold}×.`;
  }
  if (metric.startsWith('EVENT_TRANSPORTED_')) {
    const slug = metric.replace('EVENT_TRANSPORTED_', '').replace(/-/g, ' ');
    if (ruleType === 'FIRST')  return `Poprvé odveď dítě na: ${slug}.`;
    if (ruleType === 'COUNT')  return `Odveď dítě na ${slug} celkem ${threshold}×.`;
  }

  // Creator-based (organizer)
  if (metric.startsWith('EVENT_CREATED_')) {
    const slug = metric.replace('EVENT_CREATED_', '').replace(/-/g, ' ');
    if (ruleType === 'FIRST')  return `Vytvoř svou první událost: ${slug}.`;
    if (ruleType === 'COUNT')  return `Vytvoř celkem ${threshold} událostí: ${slug}.`;
  }

  const metricLabel: Record<string, string> = {
    LOGIN:              'přihlášení',
    EVENT_CREATED:      'vytvořených událostí',
    EVENT_EDITED:       'upravených událostí',
    AVAILABILITY_SET:   'zápisů dostupnosti',
    PROPOSAL_SUBMITTED: 'návrhů události',
    PROPOSAL_APPROVED:  'schválených návrhů',
    ATTACHMENT_UPLOADED:'přiložených souborů',
    THEME_CHANGED:      'změn tématu',
  };
  const m = metricLabel[metric] ?? metric.toLowerCase().replace(/_/g, ' ');

  if (ruleType === 'FIRST')   return `Udělá se automaticky při prvním: ${m}.`;
  if (ruleType === 'SPECIAL') return `Speciální odznak — splní se za: ${m}.`;
  if (ruleType === 'STREAK')  return `Přihlašuj se ${threshold} dní v řadě.`;
  if (ruleType === 'COUNT')   return `Dosáhni celkem ${threshold} ${m}.`;
  return `${threshold}× ${m}.`;
}

// ─── Tier helpers ────────────────────────────────────────────────────────────
const TIER_LABEL: Record<string, string>  = { GOLD: 'Zlato', SILVER: 'Stříbro', BRONZE: 'Bronz' };
const TIER_COLOR: Record<string, string>  = { GOLD: 'text-yellow-600', SILVER: 'text-gray-500', BRONZE: 'text-amber-700' };
const TIER_BG:    Record<string, string>  = { GOLD: 'bg-yellow-50', SILVER: 'bg-gray-100', BRONZE: 'bg-amber-50' };
const TIER_EMOJI: Record<string, string>  = { GOLD: '🥇', SILVER: '🥈', BRONZE: '🥉' };
const RULE_ICON:  Record<string, React.ReactNode> = {
  FIRST:   <Zap size={13} />,
  STREAK:  <Flame size={13} />,
  COUNT:   <Hash size={13} />,
  SPECIAL: <Trophy size={13} />,
};

// ─── Badge detail sheet ──────────────────────────────────────────────────────
interface DetailProps {
  badge: BadgeDefinition;
  earned: UserBadge | undefined;
  progressEntry: BadgeProgress | undefined;
  onClose: () => void;
}

function BadgeDetailSheet({ badge, earned, progressEntry, onClose }: DetailProps) {
  const isEarned = !!earned;

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        key="sheet"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 400 }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-surface rounded-t-2xl shadow-raised max-h-[80dvh] overflow-y-auto overscroll-contain"
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1.5 rounded-full bg-border" />
        </div>

        <div className="px-5 pb-8 pt-2 space-y-5">
          {/* Close */}
          <div className="flex justify-end">
            <button onClick={onClose} className="text-ink-faint hover:text-ink p-1 transition-colors">
              <X size={20} />
            </button>
          </div>

          {/* Icon + name */}
          <div className="flex flex-col items-center gap-3 text-center">
            <div className={`relative ${isEarned ? '' : 'grayscale opacity-50'}`}>
              <motion.span
                className="text-7xl block"
                animate={isEarned ? { scale: [1, 1.15, 1], rotate: [0, -5, 5, 0] } : {}}
                transition={{ duration: 0.5 }}
              >
                {badge.icon}
              </motion.span>
              {!isEarned && (
                <span className="absolute bottom-0 right-0 bg-surface-raised rounded-full p-1 shadow">
                  <Lock size={14} className="text-ink-muted" />
                </span>
              )}
              {isEarned && (
                <span className="absolute bottom-0 right-0 bg-success rounded-full p-1 shadow">
                  <CheckCircle2 size={14} className="text-white" />
                </span>
              )}
            </div>

            <div>
              <h2 className="text-xl font-extrabold text-ink">{badge.nameCs}</h2>
              <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full mt-1 ${TIER_BG[badge.tier]} ${TIER_COLOR[badge.tier]}`}>
                {TIER_EMOJI[badge.tier]} {TIER_LABEL[badge.tier]}
              </span>
            </div>
          </div>

          {/* Description */}
          <div className="bg-surface-raised rounded-xl p-4">
            <p className="text-sm font-semibold text-ink-muted uppercase tracking-wide mb-1">
              {isEarned ? 'Proč jsi ho dostal' : 'Co musíš splnit'}
            </p>
            <p className="text-sm text-ink leading-relaxed">{badge.descriptionCs}</p>
          </div>

          {/* Earned date */}
          {isEarned && earned && (
            <div className="flex items-center gap-3 bg-success/10 border border-success/30 rounded-xl p-4">
              <CheckCircle2 size={22} className="text-success shrink-0" />
              <div>
                <p className="font-bold text-success text-sm">Odznak získán!</p>
                <p className="text-xs text-ink-muted mt-0.5">
                  {format(new Date(earned.awardedAt), "d. MMMM yyyy 'v' HH:mm", { locale: cs })}
                </p>
              </div>
            </div>
          )}

          {/* Locked — requirement + progress */}
          {!isEarned && (
            <div className="space-y-3">
              <div className="bg-surface-raised rounded-xl p-4">
                <div className="flex items-center gap-1.5 text-xs font-bold text-ink-muted uppercase tracking-wide mb-2">
                  {RULE_ICON[badge.ruleType]}
                  <span>Podmínka</span>
                </div>
                <p className="text-sm text-ink">{ruleDescription(badge)}</p>
              </div>

              {progressEntry && progressEntry.threshold > 0 && (
                <div className="bg-surface-raised rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-ink-muted uppercase tracking-wide">Pokrok</span>
                    <span className="text-sm font-bold text-primary">
                      {progressEntry.current} / {progressEntry.threshold}
                    </span>
                  </div>
                  <div className="h-3 bg-surface-overlay rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${progressEntry.percentComplete}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                    />
                  </div>
                  <p className="text-xs text-ink-muted mt-1.5 text-right">
                    {Math.round(progressEntry.percentComplete)}% hotovo
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Category tag */}
          <p className="text-center text-xs text-ink-faint">Kategorie: {badge.category}</p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function BadgesPage() {
  const { t } = useTranslation();
  const { data: userBadges = [], isLoading: loadingBadges } = useMyBadges();
  const { data: definitions = [], isLoading: loadingDefs } = useQuery({
    queryKey: ['badge-definitions'],
    queryFn: () => api.get<{ definitions: BadgeDefinition[] }>('/badges/definitions').then((r) => r.definitions),
  });
  const { data: progress = [] } = useBadgeProgress();
  const isLoading = loadingBadges || loadingDefs;

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        <div className="skeleton h-20 rounded-2xl" />
        <div className="flex gap-2">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-8 rounded-full flex-1" />)}
        </div>
        {[...Array(8)].map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}
      </div>
    );
  }

  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selected, setSelected] = useState<BadgeDefinition | null>(null);

  const earnedMap = new Map(userBadges.map((b) => [b.badgeDefinitionId, b]));
  const progressMap = new Map(progress.map((p) => [p.badge.id, p]));

  const earnedCount = earnedMap.size;
  const totalActive = definitions.filter((d) => d.isActive).length;
  const categories = [...new Set(definitions.map((d) => d.category))];

  const filtered = activeCategory
    ? definitions.filter((d) => d.category === activeCategory)
    : definitions;

  return (
    <div className="px-4 pb-8 pt-4">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-extrabold text-ink">{t('badges.title')}</h1>
        <p className="text-ink-muted text-sm mt-1">
          <span className="font-bold text-accent text-lg">{earnedCount}</span> / {totalActive} odznaků
        </p>
        <div className="w-full h-3 bg-surface-overlay rounded-full mt-3 overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${totalActive > 0 ? (earnedCount / totalActive) * 100 : 0}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </div>
        <p className="text-xs text-ink-faint mt-2">Klepnutím na odznak zjistíš detaily</p>
      </div>

      {/* In-progress */}
      {progress.length > 0 && (
        <div className="mb-6">
          <h2 className="font-bold text-ink mb-3">🎯 Blízko k odznaku</h2>
          <div className="space-y-2">
            {progress.slice(0, 3).map((p) => (
              <button
                key={p.badge.id}
                onClick={() => setSelected(p.badge)}
                className="card p-3 w-full text-left hover:shadow-raised transition-shadow"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl">{p.badge.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-ink truncate">{p.badge.nameCs}</p>
                    <p className="text-xs text-ink-muted truncate">{p.badge.descriptionCs}</p>
                  </div>
                  <span className="text-xs text-ink-muted shrink-0">{p.current}/{p.threshold}</span>
                </div>
                <div className="h-2 bg-surface-overlay rounded-full overflow-hidden">
                  <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${p.percentComplete}%` }} />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Category filter */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none">
        <button
          onClick={() => setActiveCategory(null)}
          className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
            !activeCategory ? 'bg-primary text-white border-primary' : 'border-border text-ink-muted'
          }`}
        >
          Vše
        </button>
        {categories.map((cat) => {
          const catEarned = userBadges.filter((b) => b.badge.category === cat).length;
          const catTotal  = definitions.filter((d) => d.category === cat && d.isActive).length;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat === activeCategory ? null : cat)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
                activeCategory === cat ? 'bg-primary text-white border-primary' : 'border-border text-ink-muted'
              }`}
            >
              {t(`badges.categories.${cat}`, cat)}
              {catEarned > 0 && <span className="ml-1 opacity-70">{catEarned}/{catTotal}</span>}
            </button>
          );
        })}
      </div>

      {/* Badge grid */}
      <div className="grid grid-cols-3 gap-3">
        {filtered.map((badge, i) => {
          const earned  = earnedMap.get(badge.id);
          const prog    = progressMap.get(badge.id);
          const isEarned = !!earned;

          return (
            <motion.button
              key={badge.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.015 }}
              onClick={() => setSelected(badge)}
              className={`card p-3 flex flex-col items-center gap-1 text-center transition-all active:scale-95 ${
                isEarned ? 'border-accent/50 shadow-raised' : 'opacity-50 grayscale'
              }`}
            >
              <span className="text-3xl">{badge.icon}</span>
              <span className="text-xs font-bold text-ink leading-tight line-clamp-2">{badge.nameCs}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${TIER_BG[badge.tier]} ${TIER_COLOR[badge.tier]}`}>
                {TIER_EMOJI[badge.tier]}
              </span>

              {/* Progress mini-bar for locked badges with progress */}
              {!isEarned && prog && prog.threshold > 0 && (
                <div className="w-full h-1 bg-surface-overlay rounded-full overflow-hidden mt-0.5">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${prog.percentComplete}%` }}
                  />
                </div>
              )}

              {isEarned && (
                <span className="text-xs text-success font-semibold">✓</span>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Detail sheet */}
      {selected && (
        <BadgeDetailSheet
          badge={selected}
          earned={earnedMap.get(selected.id)}
          progressEntry={progressMap.get(selected.id)}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
