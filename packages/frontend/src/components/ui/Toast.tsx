import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  toast: (msg: string, type?: ToastType, duration?: number) => void;
  success: (msg: string) => void;
  error: (msg: string) => void;
  info: (msg: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message: string, type: ToastType = 'info', duration = 4000) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, message, duration }]);
    if (duration > 0) setTimeout(() => remove(id), duration);
  }, [remove]);

  const success = useCallback((msg: string) => toast(msg, 'success'), [toast]);
  const error   = useCallback((msg: string) => toast(msg, 'error'),   [toast]);
  const info    = useCallback((msg: string) => toast(msg, 'info'),    [toast]);

  return (
    <ToastContext.Provider value={{ toast, success, error, info }}>
      {children}
      <div className="fixed top-4 right-4 z-[60] flex flex-col gap-2 w-[calc(100vw-2rem)] max-w-sm pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0,   scale: 1   }}
              exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.15 } }}
              className="pointer-events-auto"
            >
              <ToastItem toast={t} onClose={() => remove(t.id)} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

const TOAST_STYLES = {
  success: {
    wrapper: 'bg-emerald-500 text-white',
    icon: <CheckCircle2 size={17} className="shrink-0" />,
    close: 'hover:bg-white/20',
  },
  error: {
    wrapper: 'bg-red-500 text-white',
    icon: <AlertCircle size={17} className="shrink-0" />,
    close: 'hover:bg-white/20',
  },
  info: {
    wrapper: 'bg-surface-raised text-ink border border-border shadow-raised',
    icon: <Info size={17} className="shrink-0 text-primary" />,
    close: 'hover:bg-surface-overlay',
  },
};

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const style = TOAST_STYLES[toast.type];
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold ${style.wrapper}`}
      style={{ boxShadow: '0 8px 24px rgba(0,0,0,.15)' }}
    >
      {style.icon}
      <span className="flex-1 leading-snug">{toast.message}</span>
      <button
        onClick={onClose}
        className={`w-6 h-6 flex items-center justify-center rounded-lg transition-colors shrink-0 ${style.close}`}
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be inside ToastProvider');
  return ctx;
}
