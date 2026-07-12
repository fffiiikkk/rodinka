import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.js';
import { ThemeProvider } from '../theme/ThemeProvider.js';

// Demo accounts seeded in the database (all share the same password)
const DEMO_ACCOUNTS = [
  { username: 'admin',     name: 'Filip (Filda)',    role: 'Tatínek / Admin',           emoji: '👨‍💼' },
  { username: 'mama',      name: 'Kateřina (Kačka)', role: 'Maminka',                  emoji: '👩' },
  { username: 'babicka',   name: 'Milena',           role: 'Babička (ze strany táty)', emoji: '👵' },
  { username: 'dedecek',   name: 'Jan (Děda Jan)',   role: 'Dědeček (ze strany táty)', emoji: '👴' },
  { username: 'vlasta',    name: 'Vlasta',           role: 'Babička (ze strany mámy)', emoji: '👵' },
  { username: 'strycjan',  name: 'Jan (Honza)',      role: 'Strýc (Adamův táta)',      emoji: '👨' },
  { username: 'tetaiveta', name: 'Iveta (Iva)',      role: 'Teta (Adamova máma)',      emoji: '👩' },
  { username: 'michael',   name: 'Michael (Míša)',   role: 'Syn (11 let, hokej)',       emoji: '🏒' },
  { username: 'jan',       name: 'Jan (Jenda)',      role: 'Syn (8 let, plavání)',      emoji: '🏊' },
  { username: 'adam',      name: 'Adam (Adámek)',    role: 'Bratranec',                emoji: '⚽' },
] as const;

const DEMO_PASSWORD = 'Admin123!';

function LoginForm() {
  const { t } = useTranslation();
  const { login, isLoggingIn, loginError } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loggingInAs, setLoggingInAs] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login({ username, password });
      navigate('/');
    } catch {
      // error shown via loginError
    }
  };

  const loginAs = async (acc: typeof DEMO_ACCOUNTS[number]) => {
    setLoggingInAs(acc.username);
    try {
      await login({ username: acc.username, password: DEMO_PASSWORD });
      navigate('/');
    } catch {
      // show via loginError
    } finally {
      setLoggingInAs(null);
    }
  };

  return (
    <div className="min-h-dvh bg-surface flex flex-col">
      {/* Hero gradient header */}
      <div className="bg-gradient-to-br from-primary via-primary to-accent p-8 pt-16 pb-12 text-center relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10" />
        <div className="absolute -bottom-12 -left-8 w-40 h-40 rounded-full bg-white/8" />
        <div className="absolute top-4 left-1/4 w-16 h-16 rounded-full bg-white/6" />

        <div className="relative z-10">
          <div className="w-16 h-16 mx-auto bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-raised mb-4">
            <span className="text-3xl">📅</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white">Rodinka 📅</h1>
          <p className="text-white/70 mt-1 text-sm">Vše pod kontrolou, celá rodina v pohodě</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-start justify-center p-4 -mt-6">
      <div className="w-full max-w-sm space-y-4">

        {/* Login form */}
        <div className="card p-6 shadow-modal">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">{t('auth.username')}</label>
              <input
                type="text"
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
                required
              />
            </div>

            <div>
              <label className="label">{t('auth.password')}</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink transition-colors"
                  aria-label={showPassword ? 'Skrýt heslo' : 'Zobrazit heslo'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {loginError && (
              <p className="text-sm text-danger font-medium text-center">
                {t('auth.loginError')}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="btn-primary w-full py-3 text-base"
            >
              {isLoggingIn ? t('common.loading') : t('auth.login')}
            </button>
          </form>

          <div className="mt-4 text-center">
            <a href="/forgot-password" className="text-sm text-primary hover:underline">
              {t('auth.forgotPassword')}
            </a>
          </div>
        </div>

        {/* Demo accounts */}
        <div className="card p-4">
          <p className="text-xs font-bold text-ink-muted uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <span>🧪</span> Testovací účty
            <span className="ml-auto font-normal normal-case tracking-normal text-ink-faint">
              heslo: <code className="bg-surface-raised px-1.5 py-0.5 rounded text-xs">{DEMO_PASSWORD}</code>
            </span>
          </p>
          <div className="space-y-1.5">
            {DEMO_ACCOUNTS.map((acc) => (
              <div
                key={acc.username}
                className="flex items-center gap-3 py-2 px-3 rounded-xl bg-surface-raised hover:bg-surface-overlay transition-colors group"
              >
                <span className="text-xl shrink-0">{acc.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink leading-tight">{acc.name}</p>
                  <p className="text-xs text-ink-muted truncate">
                    <code className="text-ink-faint">{acc.username}</code>
                    {' · '}{acc.role}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => loginAs(acc)}
                  disabled={!!loggingInAs}
                  className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary hover:text-white active:scale-95 transition-all disabled:opacity-50"
                  title={`Přihlásit jako ${acc.name}`}
                >
                  {loggingInAs === acc.username ? (
                    <span className="animate-pulse">…</span>
                  ) : (
                    <>
                      <LogIn size={13} />
                      Přihlásit
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-ink-faint pb-8">
          Family Calendar • v{(window as any).__APP_VERSION__ ?? 'local'}
        </p>
      </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <ThemeProvider>
      <LoginForm />
    </ThemeProvider>
  );
}
