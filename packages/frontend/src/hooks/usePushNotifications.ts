import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api.js';

export type PushPermission = 'default' | 'granted' | 'denied' | 'unsupported';

export interface PushNotificationsState {
  supported: boolean;
  permission: PushPermission;
  subscribed: boolean;
  loading: boolean;
  subscribe: () => Promise<'ok' | 'denied' | 'error'>;
  unsubscribe: () => Promise<void>;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

async function getCurrentSubscription(): Promise<PushSubscription | null> {
  const reg = await getRegistration();
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}

export function usePushNotifications(): PushNotificationsState {
  const supported =
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window;

  const [permission, setPermission] = useState<PushPermission>(
    supported ? (Notification.permission as PushPermission) : 'unsupported',
  );
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);

  // Sync initial state
  useEffect(() => {
    if (!supported) { setLoading(false); return; }
    getCurrentSubscription().then((sub) => {
      setSubscribed(!!sub);
      setPermission(Notification.permission as PushPermission);
      setLoading(false);
    });
  }, [supported]);

  const subscribe = useCallback(async (): Promise<'ok' | 'denied' | 'error'> => {
    if (!supported) return 'error';
    setLoading(true);
    try {
      // 1. Ask browser permission
      const perm = await Notification.requestPermission();
      setPermission(perm as PushPermission);
      if (perm !== 'granted') return 'denied';

      // 2. Get VAPID public key from backend
      const { publicKey } = await api.get<{ publicKey: string | null }>('/notifications/push/vapid-key');
      if (!publicKey) return 'error';

      // 3. Subscribe via service worker
      const reg = await getRegistration();
      if (!reg) return 'error';
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey).buffer as ArrayBuffer,
      });

      // 4. Send subscription to backend
      const subJson = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      await api.post('/notifications/push/subscribe', subJson);

      setSubscribed(true);
      return 'ok';
    } catch (e) {
      console.error('Push subscribe failed', e);
      return 'error';
    } finally {
      setLoading(false);
    }
  }, [supported]);

  const unsubscribe = useCallback(async () => {
    setLoading(true);
    try {
      const sub = await getCurrentSubscription();
      if (sub) {
        await api.delete('/notifications/push/unsubscribe', { endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } finally {
      setLoading(false);
    }
  }, []);

  return { supported, permission, subscribed, loading, subscribe, unsubscribe };
}
