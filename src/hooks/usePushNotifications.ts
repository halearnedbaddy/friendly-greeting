import { useState, useEffect, useCallback } from 'react';



interface PushState {
  isSupported: boolean;
  isSubscribed: boolean;
  permission: NotificationPermission | 'default';
}

export function usePushNotifications() {
  const [state, setState] = useState<PushState>({
    isSupported: false,
    isSubscribed: false,
    permission: 'default',
  });

  useEffect(() => {
    const supported = 'Notification' in window && 'serviceWorker' in navigator;
    setState(prev => ({
      ...prev,
      isSupported: supported,
      permission: supported ? Notification.permission : 'default',
    }));
  }, []);

  const requestPermission = useCallback(async () => {
    if (!state.isSupported) return false;

    try {
      const permission = await Notification.requestPermission();
      setState(prev => ({ ...prev, permission }));

      if (permission === 'granted') {
        // Register with service worker
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: undefined, // Will be set via OneSignal
        }).catch(() => null);

        if (subscription) {
          setState(prev => ({ ...prev, isSubscribed: true }));
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }, [state.isSupported]);

  const sendLocalNotification = useCallback((title: string, body: string, icon?: string) => {
    if (Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: icon || '/pwa-icon-192.png',
        badge: '/pwa-icon-192.png',
      });
    }
  }, []);

  return { ...state, requestPermission, sendLocalNotification };
}
