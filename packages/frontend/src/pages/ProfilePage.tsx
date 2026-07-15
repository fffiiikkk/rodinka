import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Camera, Moon, Sun, Monitor, LogOut, Loader2, Bell, BellOff, BellRing, Calendar, RefreshCw, Trash2, Plus, X, ExternalLink } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.js';
import { useMyBadges } from '../hooks/useBadges.js';
import { usePushNotifications } from '../hooks/usePushNotifications.js';
import { useFeatureFlag } from '../hooks/useFeatureFlag.js';
import { api } from '../lib/api.js';
import { useTheme } from '../theme/ThemeProvider.js';
import { THEMES } from '@rodinkal/shared';
import Avatar from '../components/ui/Avatar.js';
import { useToast } from '../components/ui/Toast.js';
import type { ColorMode, ThemeKey, FontScale } from '@rodinkal/shared';

const RELATIONSHIP_OPTIONS = [
  'Tatínek', 'Maminka',
  'Syn', 'Dcera',
  'Bratr', 'Sestra',
  'Bratranec', 'Sestřenice',
  'Strýc', 'Teta',
  'Dědeček', 'Babička',
];

// ── Client-side image resize before upload ────────────────────────────────────
const MAX_PHOTO_PX = 512;
const MAX_PHOTO_BYTES = 300 * 1024; // 300 KB

async function resizePhoto(file: File): Promise<File> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, MAX_PHOTO_PX / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);

      // Try qualities until small enough
      const tryQuality = (q: number) => {
        canvas.toBlob((blob) => {
          if (!blob) { resolve(file); return; }
          if (blob.size <= MAX_PHOTO_BYTES || q <= 0.5) {
            resolve(new File([blob], 'photo.jpg', { type: 'image/jpeg', lastModified: Date.now() }));
          } else {
            tryQuality(q - 0.1);
          }
        }, 'image/jpeg', q);
      };
      tryQuality(0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

export default function ProfilePage() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { theme, colorMode, fontScale, setTheme, setColorMode, setFontScale } = useTheme();
  const { data: badges } = useMyBadges();
  const push = usePushNotifications();
  const fileRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [name, setName] = useState(user?.name ?? '');
  const [nickname, setNickname] = useState(user?.nickname ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [mobile, setMobile] = useState(user?.mobile ?? '');
  const [relationship, setRelationship] = useState(user?.relationship ?? '');

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await api.patch('/users/me', {
        name,
        nickname: nickname || null,
        email,
        mobile: mobile || null,
        relationship: relationship || null,
      });
      qc.invalidateQueries({ queryKey: ['auth', 'me'] });
      toast(t('profile.saved'), 'success');
    } catch { toast(t('errors.generic'), 'error'); }
    finally { setSaving(false); }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Show local preview immediately
    const previewUrl = URL.createObjectURL(file);
    setPhotoPreview(previewUrl);
    setPhotoUploading(true);
    try {
      const resized = await resizePhoto(file);
      const fd = new FormData();
      fd.append('photo', resized);
      await api.upload('/users/me/photo', fd);
      await qc.invalidateQueries({ queryKey: ['auth', 'me'] });
      toast('Fotka nahrána ✓', 'success');
      setPhotoPreview(null);
    } catch {
      toast(t('errors.generic'), 'error');
      setPhotoPreview(null);
    } finally {
      setPhotoUploading(false);
      URL.revokeObjectURL(previewUrl);
      // Reset input so same file can be re-selected
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleThemeChange = async (t: ThemeKey) => {
    setTheme(t);
    await api.patch('/users/me/theme', { theme: t, colorMode, fontScale });
  };

  const handleColorModeChange = async (m: ColorMode) => {
    setColorMode(m);
    await api.patch('/users/me/theme', { theme, colorMode: m, fontScale });
  };

  const handleFontScaleChange = async (s: FontScale) => {
    setFontScale(s);
    await api.patch('/users/me/theme', { theme, colorMode, fontScale: s });
  };

  const handleLanguage = async (lang: string) => {
    await i18n.changeLanguage(lang);
    await api.patch('/users/me', { preferredLanguage: lang.toUpperCase() });
    localStorage.setItem('language', lang);
  };

  if (!user) return null;

  const earnedCount = badges?.length ?? 0;

  return (
    <div className="px-4 pb-8 space-y-6 pt-4">
      {/* Avatar + name */}
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          {/* Show preview or current photo */}
          {photoPreview ? (
            <div className="relative w-24 h-24">
              <img src={photoPreview} alt="preview" className="w-24 h-24 rounded-full object-cover border-4 border-primary shadow-raised" />
              {photoUploading && (
                <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center">
                  <Loader2 size={24} className="text-white animate-spin" />
                </div>
              )}
            </div>
          ) : (
            <Avatar name={user.name} photoUrl={user.photoUrl} size="xl" />
          )}

          <button
            onClick={() => fileRef.current?.click()}
            disabled={photoUploading}
            className="absolute bottom-0 right-0 w-9 h-9 bg-primary text-white rounded-full flex items-center justify-center shadow-raised disabled:opacity-50 transition-opacity"
            title="Nahrát foto"
          >
            {photoUploading ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />}
          </button>
          <input ref={fileRef} type="file" accept="image/*" capture="user" className="hidden" onChange={handlePhotoUpload} />
        </div>

        <div className="text-center">
          <h2 className="text-xl font-extrabold text-ink">
            {user.name}
            {user.nickname && <span className="text-ink-muted font-normal ml-1.5 text-base">({user.nickname})</span>}
          </h2>
          <p className="text-sm text-ink-muted">{t(`roles.${user.role}`)}</p>
          {user.relationship && (
            <p className="text-sm text-primary font-semibold mt-0.5">👨‍👩‍👧 {user.relationship}</p>
          )}
          <p className="text-sm text-accent font-semibold mt-1">🏅 {earnedCount} odznaků</p>
          <p className="text-xs text-ink-faint mt-0.5">Klepnutím na fotoaparát nahrajete novou fotku</p>
        </div>
      </div>

      {/* Profile data */}
      <div className="card p-4 space-y-3">
        <h3 className="font-bold text-ink">{t('profile.title')}</h3>
        <div>
          <label className="label">
            {t('profile.name')}
            <span className="text-ink-faint font-normal ml-1 text-xs">(používá se pro jmeniny)</span>
          </label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">
            Přezdívka / rodinné jméno
            <span className="text-ink-faint font-normal ml-1 text-xs">(nepovinné, zobrazuje se místo jména)</span>
          </label>
          <input
            className="input"
            placeholder="např. Jenda, Kačka, Míša…"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
          />
        </div>
        <div>
          <label className="label">{t('profile.email')}</label>
          <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label">{t('profile.mobile')}</label>
          <input type="tel" className="input" value={mobile} onChange={(e) => setMobile(e.target.value)} />
        </div>
        <div>
          <label className="label">Vztah k dětem</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {RELATIONSHIP_OPTIONS.map((opt) => (
              <button key={opt} type="button"
                onClick={() => setRelationship(opt === relationship ? '' : opt)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                  relationship === opt
                    ? 'bg-primary text-white border-primary'
                    : 'border-border bg-surface-raised hover:border-primary/50'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
          <input className="input" placeholder="nebo napiš vlastní…"
            value={relationship} onChange={(e) => setRelationship(e.target.value)} />
        </div>
        <button onClick={handleSaveProfile} disabled={saving} className="btn-primary w-full">
          {saving ? t('common.loading') : t('profile.save')}
        </button>
      </div>

      {/* Theme picker */}
      <div className="card p-4 space-y-3">
        <h3 className="font-bold text-ink">{t('profile.theme')}</h3>
        <div className="grid grid-cols-5 gap-2">
          {THEMES.map((th) => (
            <button
              key={th.key}
              onClick={() => handleThemeChange(th.key)}
              className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all ${
                theme === th.key ? 'border-primary scale-105' : 'border-border hover:border-primary/50'
              }`}
            >
              <span className="text-2xl">{th.emoji}</span>
              <span className="text-xs font-semibold text-ink">{t(`themes.${th.key}`)}</span>
            </button>
          ))}
        </div>

        {/* Color mode */}
        <div>
          <label className="label">{t('profile.colorMode')}</label>
          <div className="flex gap-2">
            {(['LIGHT', 'DARK', 'SYSTEM'] as ColorMode[]).map((m) => {
              const icons = { LIGHT: Sun, DARK: Moon, SYSTEM: Monitor };
              const Icon = icons[m];
              return (
                <button
                  key={m}
                  onClick={() => handleColorModeChange(m)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-sm font-medium transition-all ${
                    colorMode === m ? 'border-primary bg-primary/10 text-primary' : 'border-border text-ink-muted'
                  }`}
                >
                  <Icon size={16} />
                  {t(`profile.colorModes.${m}`)}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Accessibility – font scale */}
      <div className="card p-4 space-y-3">
        <h3 className="font-bold text-ink flex items-center gap-2">
          <span className="text-lg">👁️</span> Přístupnost
        </h3>
        <p className="text-xs text-ink-muted">Velikost písma pro snadnější čtení. Vhodné pro starší členy rodiny.</p>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { value: 'NORMAL',  label: 'Normální',     preview: 'Aa',   desc: 'Výchozí velikost' },
              { value: 'LARGE',   label: 'Velké písmo',  preview: 'Aa',   desc: '~18 px základ' },
              { value: 'XLARGE',  label: 'Největší',     preview: 'Aa',   desc: '~20 px základ' },
            ] as { value: FontScale; label: string; preview: string; desc: string }[]
          ).map(({ value, label, preview, desc }) => (
            <button
              key={value}
              onClick={() => handleFontScaleChange(value)}
              className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                fontScale === value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-ink-muted hover:border-primary/50'
              }`}
            >
              <span
                className="font-bold leading-none"
                style={{ fontSize: value === 'NORMAL' ? '1.1rem' : value === 'LARGE' ? '1.3rem' : '1.55rem' }}
              >
                {preview}
              </span>
              <span className="text-xs font-semibold mt-0.5">{label}</span>
              <span className="text-[10px] opacity-60">{desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Language */}
      <div className="card p-4 space-y-3">
        <h3 className="font-bold text-ink">{t('profile.language')}</h3>
        <div className="flex gap-2">
          {['cs', 'en'].map((lang) => (
            <button
              key={lang}
              onClick={() => handleLanguage(lang)}
              className={`flex-1 py-2 rounded-lg border font-semibold text-sm transition-all ${
                i18n.language === lang ? 'border-primary bg-primary/10 text-primary' : 'border-border text-ink-muted'
              }`}
            >
              {lang === 'cs' ? '🇨🇿 Čeština' : '🇬🇧 English'}
            </button>
          ))}
        </div>
      </div>

      {/* Push notifications */}
      {push.supported && (
        <div className="card p-4 space-y-3">
          <h3 className="font-bold text-ink flex items-center gap-2">
            <Bell size={18} className="text-primary" /> Notifikace
          </h3>

          {push.permission === 'denied' ? (
            <div className="flex items-start gap-3 bg-warning/10 border border-warning/30 rounded-xl p-3">
              <BellOff size={20} className="text-warning shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-ink">Notifikace jsou zablokované</p>
                <p className="text-xs text-ink-muted mt-0.5">
                  Povolení jsi odmítl/a v prohlížeči. Aby fungovaly, musíš je ručně povolit v nastavení prohlížeče
                  — ikona zámku v adresním řádku → Notifikace → Povolit.
                </p>
              </div>
            </div>
          ) : push.subscribed ? (
            <div className="space-y-2">
              <div className="flex items-center gap-3 bg-success/10 border border-success/30 rounded-xl p-3">
                <BellRing size={20} className="text-success shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-success">Notifikace jsou aktivní</p>
                  <p className="text-xs text-ink-muted mt-0.5">Dostaneš připomínku před každou událostí.</p>
                </div>
              </div>
              <button
                onClick={async () => {
                  await push.unsubscribe();
                  toast('Notifikace vypnuty', 'info');
                }}
                disabled={push.loading}
                className="w-full py-2 rounded-xl border border-danger/30 text-danger text-sm font-semibold flex items-center justify-center gap-2 hover:bg-danger/5 transition-colors disabled:opacity-50"
              >
                {push.loading ? <Loader2 size={16} className="animate-spin" /> : <BellOff size={16} />}
                Vypnout notifikace
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-ink-muted">
                Zapni push notifikace a dostaneš připomínku před každou aktivitou — i když máš aplikaci zavřenou.
              </p>
              <button
                onClick={async () => {
                  const result = await push.subscribe();
                  if (result === 'ok') toast('Notifikace zapnuty ✓', 'success');
                  else if (result === 'denied') toast('Povolení zamítnuto', 'error');
                  else toast('Nepodařilo se zapnout notifikace', 'error');
                }}
                disabled={push.loading}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {push.loading ? <Loader2 size={16} className="animate-spin" /> : <Bell size={16} />}
                Zapnout notifikace
              </button>
            </div>
          )}
        </div>
      )}

      {/* External Calendars */}
      <ExternalCalendarsSection />

      {/* Logout */}
      <button
        onClick={() => logout()}
        className="w-full flex items-center justify-center gap-2 py-3 text-danger border border-danger/30 rounded-xl font-semibold"
      >
        <LogOut size={18} /> {t('auth.logout')}
      </button>
    </div>
  );
}

// ─── External Calendars Section ──────────────────────────────────────────────

interface ExtCalSub {
  id: string;
  name: string;
  icsUrl: string | null;
  isActive: boolean;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastSyncError: string | null;
  createdAt: string;
  _count: { events: number };
}

function ExternalCalendarsSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const externalCalendarEnabled = useFeatureFlag('external_calendar_import');
  const [showAdd, setShowAdd] = useState(false);
  const [addMode, setAddMode] = useState<'url' | 'file'>('url');
  const [name, setName] = useState('');
  const [icsUrl, setIcsUrl] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery<{ subscriptions: ExtCalSub[] }>({
    queryKey: ['external-calendars'],
    queryFn: () => api.get('/external-calendars'),
    enabled: externalCalendarEnabled,
    staleTime: 60_000,
  });

  const add = useMutation({
    mutationFn: (body: { name: string; icsUrl?: string; icsText?: string }) =>
      api.post('/external-calendars', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['external-calendars'] });
      qc.invalidateQueries({ queryKey: ['events'] });
      toast('✅ Kalendář přidán', 'success');
      setShowAdd(false);
      setName('');
      setIcsUrl('');
    },
    onError: () => toast('❌ Přidání selhalo', 'error'),
  });

  const sync = useMutation({
    mutationFn: (id: string) => api.post(`/external-calendars/${id}/sync`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['external-calendars'] });
      qc.invalidateQueries({ queryKey: ['events'] });
      toast('🔄 Synchronizováno', 'success');
    },
    onError: () => toast('❌ Synchronizace selhala', 'error'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/external-calendars/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['external-calendars'] });
      qc.invalidateQueries({ queryKey: ['events'] });
      toast('🗑️ Kalendář odebrán', 'info');
    },
  });

  function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !name.trim()) { toast('Zadejte nejprve název', 'warning'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      add.mutate({ name, icsText: text });
    };
    reader.readAsText(file, 'utf-8');
  }

  if (!externalCalendarEnabled) return null;

  const subs = data?.subscriptions ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-ink flex items-center gap-2">
          <Calendar size={16} className="text-primary" />
          Externí kalendáře
        </h3>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="text-xs text-primary font-semibold flex items-center gap-1 hover:underline"
        >
          <Plus size={12} /> Přidat
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="card p-3 space-y-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAddMode('url')}
              className={`flex-1 text-xs py-1.5 rounded-lg border font-semibold transition-colors ${
                addMode === 'url' ? 'bg-primary text-white border-primary' : 'border-border text-ink-muted'
              }`}
            >
              🔗 URL (Google/Outlook)
            </button>
            <button
              type="button"
              onClick={() => setAddMode('file')}
              className={`flex-1 text-xs py-1.5 rounded-lg border font-semibold transition-colors ${
                addMode === 'file' ? 'bg-primary text-white border-primary' : 'border-border text-ink-muted'
              }`}
            >
              📁 Nahrát soubor
            </button>
          </div>

          <input
            className="input text-sm"
            placeholder="Název (např. Práce — Google)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          {addMode === 'url' ? (
            <div className="space-y-2">
              <input
                className="input text-sm"
                placeholder="https://calendar.google.com/calendar/ical/…"
                value={icsUrl}
                onChange={(e) => setIcsUrl(e.target.value)}
              />
              <p className="text-[10px] text-ink-muted">
                V Google Kalendáři: Nastavení → Klíčová slova → Tajná adresa ve formátu iCal
              </p>
              <button
                type="button"
                onClick={() => {
                  if (!name.trim() || !icsUrl.trim()) { toast('Vyplňte název a URL', 'warning'); return; }
                  add.mutate({ name, icsUrl });
                }}
                disabled={add.isPending}
                className="btn-primary text-sm w-full disabled:opacity-50"
              >
                {add.isPending ? 'Přidávám…' : 'Přidat a synchronizovat'}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="btn-secondary text-sm w-full"
              >
                📎 Vybrat .ics soubor
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".ics,text/calendar"
                className="hidden"
                onChange={handleFileImport}
              />
            </div>
          )}

          <button type="button" onClick={() => setShowAdd(false)} className="text-xs text-ink-muted hover:text-ink w-full text-center">
            Zrušit
          </button>
        </div>
      )}

      {/* List */}
      {isLoading && <p className="text-xs text-ink-muted">Načítám…</p>}
      {subs.length === 0 && !isLoading && !showAdd && (
        <p className="text-xs text-ink-muted">Žádné externí kalendáře. Přidejte Google, Outlook nebo .ics soubor.</p>
      )}
      {subs.map((sub) => (
        <div key={sub.id} className="card p-3 flex items-center gap-3">
          <Calendar size={14} className="text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-ink truncate">{sub.name}</p>
            <p className="text-[10px] text-ink-muted">
              {sub._count.events} událostí
              {sub.lastSyncAt && ` · sync ${new Date(sub.lastSyncAt).toLocaleDateString('cs-CZ')}`}
              {sub.lastSyncStatus === 'ERROR' && (
                <span className="ml-1 text-danger">⚠️ {sub.lastSyncError}</span>
              )}
            </p>
          </div>
          {sub.icsUrl && (
            <button
              type="button"
              onClick={() => sync.mutate(sub.id)}
              disabled={sync.isPending}
              className="p-1.5 rounded-lg text-primary hover:bg-primary/10 disabled:opacity-50"
              title="Synchronizovat"
            >
              <RefreshCw size={14} />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (confirm(`Odebrat "${sub.name}" a všechny jeho události?`)) remove.mutate(sub.id);
            }}
            className="p-1.5 rounded-lg text-danger hover:bg-danger/10"
            title="Odebrat"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
