import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Mail } from 'lucide-react';
import { api } from '../lib/api.js';
import { ThemeProvider } from '../theme/ThemeProvider.js';

function ForgotPasswordForm() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.post('/auth/password-reset/request', { email });
      setSent(true);
    } catch {
      setError(t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh bg-surface flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm card p-6 shadow-modal space-y-4">
        <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-primary transition-colors">
          <ArrowLeft size={16} />
          {t('auth.login')}
        </Link>

        <div className="text-center">
          <div className="w-12 h-12 mx-auto bg-primary/10 rounded-2xl flex items-center justify-center mb-3">
            <Mail size={22} className="text-primary" />
          </div>
          <h1 className="text-xl font-extrabold text-ink">{t('auth.forgotPassword')}</h1>
          <p className="text-sm text-ink-muted mt-1">
            Zadejte e-mail účtu — pošleme odkaz pro obnovení hesla.
          </p>
        </div>

        {sent ? (
          <p className="text-sm text-success font-medium text-center py-2">{t('auth.resetSent')}</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">{t('profile.email')}</label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                autoFocus
              />
            </div>
            {error && <p className="text-sm text-danger text-center">{error}</p>}
            <button type="submit" disabled={submitting} className="btn-primary w-full py-3">
              {submitting ? t('common.loading') : t('auth.resetPassword')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <ThemeProvider>
      <ForgotPasswordForm />
    </ThemeProvider>
  );
}
