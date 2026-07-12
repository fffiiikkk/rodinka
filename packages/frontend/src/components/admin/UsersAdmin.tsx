import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { UserPlus, Edit, Eye, Trash2, AlertTriangle, X } from 'lucide-react';
import { api } from '../../lib/api.js';
import Avatar from '../ui/Avatar.js';
import Sheet from '../ui/Sheet.js';
import { useToast } from '../ui/Toast.js';

const ROLES = ['PARENT', 'GRANDPARENT', 'RELATIVE', 'KID', 'GUEST'] as const;
const LANGUAGES = ['CS', 'EN'] as const;
const RELATIONSHIP_OPTIONS = [
  'Tatínek', 'Maminka',
  'Syn', 'Dcera',
  'Bratr', 'Sestra',
  'Bratranec', 'Sestřenice',
  'Strýc', 'Teta',
  'Dědeček', 'Babička',
];

interface UserRow {
  id: string;
  username: string;
  name: string;
  nickname?: string | null;
  email: string;
  mobile: string | null;
  dateOfBirth: string | null;
  role: string;
  isActive: boolean;
  photoUrl: string | null;
  preferredLanguage: string;
  relationship?: string | null;
}

interface EditState {
  name: string;
  nickname: string;
  email: string;
  mobile: string;
  dateOfBirth: string;
  role: string;
  isActive: boolean;
  preferredLanguage: string;
  relationship: string;
  newPassword: string;
}

export default function UsersAdmin() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [form, setForm] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  // Delete confirmation: null = idle, string = userId pending first confirm, 'deleting' = in progress
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => api.get<{ items: UserRow[] }>('/users?pageSize=100'),
  });

  const openEdit = (user: UserRow) => {
    setEditingUser(user);
    setForm({
      name: user.name,
      nickname: user.nickname ?? '',
      email: user.email,
      mobile: user.mobile ?? '',
      dateOfBirth: user.dateOfBirth ? user.dateOfBirth.slice(0, 10) : '',
      role: user.role,
      isActive: user.isActive,
      preferredLanguage: user.preferredLanguage,
      relationship: user.relationship ?? '',
      newPassword: '',
    });
  };

  const closeEdit = () => {
    setEditingUser(null);
    setForm(null);
  };

  const handleSave = async () => {
    if (!editingUser || !form) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        nickname: form.nickname || null,
        email: form.email,
        mobile: form.mobile || null,
        dateOfBirth: form.dateOfBirth ? new Date(form.dateOfBirth).toISOString() : null,
        role: form.role,
        isActive: form.isActive,
        preferredLanguage: form.preferredLanguage,
        relationship: form.relationship || null,
      };
      await api.patch(`/users/${editingUser.id}`, payload);

      if (form.newPassword) {
        await api.post(`/users/${editingUser.id}/admin-reset-password`, { newPassword: form.newPassword });
      }

      await qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast('Uživatel uložen', 'success');
      closeEdit();
    } catch {
      toast('Nepodařilo se uložit', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (userId: string, userName: string) => {
    if (deleteConfirm !== userId) {
      // Step 1: arm the confirmation
      setDeleteConfirm(userId);
      return;
    }
    // Step 2: confirmed — execute
    setDeleting(true);
    try {
      await api.delete(`/users/${userId}`);
      await qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast(`Uživatel ${userName} byl smazán`, 'success');
    } catch {
      toast('Nepodařilo se smazat uživatele', 'error');
    } finally {
      setDeleting(false);
      setDeleteConfirm(null);
    }
  };

  const handleImpersonate = async (userId: string) => {
    await api.post(`/users/${userId}/impersonate`);
    qc.invalidateQueries({ queryKey: ['auth', 'me'] });
    toast('Zobrazení jako uživatel aktivováno', 'info');
    window.location.href = '/';
  };

  const set = (key: keyof EditState, value: string | boolean) =>
    setForm((f) => f ? { ...f, [key]: value } : f);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-ink">{t('admin.users')}</h2>
        <button className="btn-primary flex items-center gap-1.5 px-3 py-2 text-sm">
          <UserPlus size={16} /> {t('admin.createUser')}
        </button>
      </div>

      <div className="space-y-2">
        {data?.items.map((user) => (
          <div key={user.id} className={`overflow-hidden rounded-2xl border border-border transition-all ${!user.isActive ? 'opacity-50' : ''}`}>
            {/* Main row */}
            <div className="card p-3 flex items-center gap-3 border-0 rounded-none">
              <Avatar name={user.name} photoUrl={user.photoUrl} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">
                  {user.name}
                  {user.nickname && <span className="text-ink-faint font-normal ml-1 text-xs">({user.nickname})</span>}
                </p>
                <p className="text-xs text-ink-muted">
                  {user.username} · {t(`roles.${user.role}`)}
                  {user.relationship && <span className="text-primary"> · {user.relationship}</span>}
                </p>
              </div>
              <div className="flex items-center gap-0.5">
                <button onClick={() => openEdit(user)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-ink-muted hover:text-primary hover:bg-surface-raised transition-all"
                  title={t('common.edit')}
                >
                  <Edit size={15} />
                </button>
                <button onClick={() => handleImpersonate(user.id)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-ink-muted hover:text-primary hover:bg-surface-raised transition-all"
                  title={t('admin.impersonate')}
                >
                  <Eye size={15} />
                </button>
                {/* Step 1: arm delete */}
                {deleteConfirm !== user.id && (
                  <button
                    onClick={() => setDeleteConfirm(user.id)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-ink-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all"
                    title="Smazat uživatele"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
                {/* Step 1 armed: show cancel */}
                {deleteConfirm === user.id && (
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-ink-muted hover:text-ink hover:bg-surface-raised transition-all"
                    title="Zrušit"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
            </div>

            {/* Step 2: confirmation strip — slides in */}
            {deleteConfirm === user.id && (
              <div className="flex items-center gap-3 px-3 py-2.5 bg-red-50 dark:bg-red-950/30 border-t border-red-200 dark:border-red-800">
                <AlertTriangle size={15} className="text-red-600 shrink-0" />
                <p className="flex-1 text-xs font-semibold text-red-700 dark:text-red-300">
                  Smazat <strong>{user.name}</strong>? Akce je nevratná.
                </p>
                <button
                  onClick={() => handleDelete(user.id, user.name)}
                  disabled={deleting}
                  className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50 shrink-0"
                >
                  {deleting ? '…' : 'Ano, smazat'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Edit sheet */}
      <Sheet open={!!editingUser} onClose={closeEdit} title={`Upravit: ${editingUser?.name ?? ''}`}>
        {form && (
          <div className="p-4 space-y-4">
            {/* Name */}
            <div>
              <label className="block text-xs font-semibold text-ink-muted mb-1">
                Jméno <span className="font-normal text-ink-faint">(používá se pro jmeniny)</span>
              </label>
              <input className="input w-full" value={form.name} onChange={(e) => set('name', e.target.value)} />
            </div>
            {/* Nickname */}
            <div>
              <label className="block text-xs font-semibold text-ink-muted mb-1">
                Přezdívka <span className="font-normal text-ink-faint">(nepovinné)</span>
              </label>
              <input
                className="input w-full"
                placeholder="např. Jenda, Kačka, Míša…"
                value={form.nickname}
                onChange={(e) => set('nickname', e.target.value)}
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-ink-muted mb-1">E-mail</label>
              <input
                type="email"
                className="input w-full"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
              />
            </div>

            {/* Mobile */}
            <div>
              <label className="block text-xs font-semibold text-ink-muted mb-1">Mobil</label>
              <input
                type="tel"
                className="input w-full"
                placeholder="+420 000 000 000"
                value={form.mobile}
                onChange={(e) => set('mobile', e.target.value)}
              />
            </div>

            {/* Date of birth */}
            <div>
              <label className="block text-xs font-semibold text-ink-muted mb-1">Datum narození</label>
              <input
                type="date"
                className="input w-full"
                value={form.dateOfBirth}
                onChange={(e) => set('dateOfBirth', e.target.value)}
              />
            </div>

            {/* Role */}
            <div>
              <label className="block text-xs font-semibold text-ink-muted mb-1">Role</label>
              <select
                className="input w-full"
                value={form.role}
                onChange={(e) => set('role', e.target.value)}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{t(`roles.${r}`)}</option>
                ))}
              </select>
            </div>

            {/* Language */}
            <div>
              <label className="block text-xs font-semibold text-ink-muted mb-1">Jazyk</label>
              <select
                className="input w-full"
                value={form.preferredLanguage}
                onChange={(e) => set('preferredLanguage', e.target.value)}
              >
                {LANGUAGES.map((l) => (
                  <option key={l} value={l}>{l === 'CS' ? 'Čeština' : 'English'}</option>
                ))}
              </select>
            </div>

            {/* Relationship */}
            <div>
              <label className="block text-xs font-semibold text-ink-muted mb-1">Vztah k dětem</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {RELATIONSHIP_OPTIONS.map((opt) => (
                  <button key={opt} type="button"
                    onClick={() => set('relationship', form.relationship === opt ? '' : opt)}
                    className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-all ${
                      form.relationship === opt
                        ? 'bg-primary text-white border-primary'
                        : 'border-border bg-surface-raised'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
              <input className="input w-full" placeholder="nebo napiš vlastní…"
                value={form.relationship} onChange={(e) => set('relationship', e.target.value)} />
            </div>

            {/* Active */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 accent-primary"
                checked={form.isActive}
                onChange={(e) => set('isActive', e.target.checked)}
              />
              <span className="text-sm font-medium text-ink">Aktivní účet</span>
            </label>

            {/* New password */}
            <div>
              <label className="block text-xs font-semibold text-ink-muted mb-1">
                Nové heslo <span className="font-normal">(nechat prázdné = beze změny)</span>
              </label>
              <input
                type="password"
                className="input w-full"
                placeholder="Minimálně 8 znaků, velké písmeno, číslo"
                value={form.newPassword}
                onChange={(e) => set('newPassword', e.target.value)}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-primary flex-1 py-2.5 text-sm font-semibold disabled:opacity-50"
              >
                {saving ? 'Ukládám…' : 'Uložit změny'}
              </button>
              <button
                onClick={closeEdit}
                className="btn-ghost flex-1 py-2.5 text-sm font-semibold"
              >
                Zrušit
              </button>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}
