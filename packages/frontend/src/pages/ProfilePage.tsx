import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Camera, Moon, Sun, Monitor, LogOut, Loader2, Bell, BellOff, BellRing } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.js';
import { useMyBadges } from '../hooks/useBadges.js';
import { usePushNotifications } from '../hooks/usePushNotifications.js';
import { api } from '../lib/api.js';
import { useTheme } from '../theme/ThemeProvider.js';
import { THEMES } from '@rodinkal/shared';
import Avatar from '../components/ui/Avatar.js';
import { useToast } from '../components/ui/Toast.js';
import type { ColorMode, ThemeKey } from '@rodinkal/shared';

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
  const { theme, colorMode, setTheme, setColorMode } = useTheme();
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
    await api.patch('/users/me/theme', { theme: t, colorMode });
  };

  const handleColorModeChange = async (m: ColorMode) => {
    setColorMode(m);
    await api.patch('/users/me/theme', { theme, colorMode: m });
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
