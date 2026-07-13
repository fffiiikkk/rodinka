/**
 * One-shot push-notification prompt shown a few seconds after login.
 * Dismissed permanently (localStorage) once the user taps Yes or No.
 * Never shown if permission is already 'granted' or 'denied'.
 */
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X } from 'lucide-react';
import { usePushNotifications } from '../../hooks/usePushNotifications.js';
import { useToast } from './Toast.js';

const STORAGE_KEY = 'push_prompt_dismissed';

export default function PushPrompt() {
  const push = usePushNotifications();
  const { toast } = useToast();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!push.supported) return;
    if (push.loading) return;
    if (push.permission !== 'default') return;       // already decided
    if (push.subscribed) return;                      // already subscribed
    if (localStorage.getItem(STORAGE_KEY)) return;   // dismissed before

    // Show after 4 seconds
    const t = setTimeout(() => setVisible(true), 4000);
    return () => clearTimeout(t);
  }, [push.supported, push.loading, push.permission, push.subscribed]);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  };

  const accept = async () => {
    dismiss();
    const result = await push.subscribe();
    if (result === 'ok') toast('Notifikace zapnuty ✓', 'success');
    else if (result === 'denied') toast('Povolení zamítnuto — lze změnit v nastavení prohlížeče', 'info');
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 26, stiffness: 360 }}
          className="fixed bottom-20 left-3 right-3 z-50 max-w-sm mx-auto"
        >
          <div className="bg-surface border border-border shadow-raised rounded-2xl p-4 flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Bell size={20} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-ink">Zapnout připomínky?</p>
              <p className="text-xs text-ink-muted mt-0.5 leading-snug">
                Dostaneš notifikaci před každou aktivitou dětí — i když máš appku zavřenou.
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={accept}
                  className="flex-1 py-1.5 bg-primary text-white rounded-lg text-sm font-semibold"
                >
                  Ano, zapnout
                </button>
                <button
                  onClick={dismiss}
                  className="flex-1 py-1.5 border border-border text-ink-muted rounded-lg text-sm font-semibold"
                >
                  Teď ne
                </button>
              </div>
            </div>
            <button onClick={dismiss} className="text-ink-faint hover:text-ink shrink-0 -mt-1 -mr-1 p-1">
              <X size={16} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
