import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { KeyRound } from 'lucide-react';
import { api } from '../lib/api.js';
import { ThemeProvider } from '../theme/ThemeProvider.js';

function ResetPasswordForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError(t('auth.passwordTooShort'));
      return;
    }
    if (password !== confirm) {
      setError('Hesla se neshodují');
      return;
    }
    if (!token) {
      setError('Neplatný odkaz');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await api.post('/auth/password-reset/confirm', { token, password });
      navigate('/login', { replace: true, state: { resetSuccess: true } });
    } catch {
      setError('Odkaz vypršel nebo je neplatný');
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-dvh bg-surface flex items-center justify-center p-4">
        <div className="card p-6 max-w-sm text-center space-y-3">
          <p className="text-ink-muted">Neplatný odkaz pro reset hesla.</p>
          <Link to="/forgot-password" className="text-primary font-semibold hover:underline">
            {t('auth.forgotPassword')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-surface flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm card p-6 shadow-modal space-y-4">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto bg-primary/10 rounded-2xl flex items-center justify-center mb-3">
            <KeyRound size={22} className="text-primary" />
          </div>
          <h1 className="text-xl font-extrabold text-ink">{t('auth.resetPassword')}</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">{t('auth.newPassword')}</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
              autoFocus
            />
          </div>
          <div>
            <label className="label">Potvrzení hesla</label>
            <input
              type="password"
              className="input"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          {error && <p className="text-sm text-danger text-center">{error}</p>}
          <button type="submit" disabled={submitting} className="btn-primary w-full py-3">
            {submitting ? t('common.loading') : t('auth.resetPassword')}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <ThemeProvider>
      <ResetPasswordForm />
    </ThemeProvider>
  );
}
