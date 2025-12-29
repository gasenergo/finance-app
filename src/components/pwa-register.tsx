// src/components/pwa-register.tsx
'use client';

import { useEffect } from 'react';

export function PWARegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => console.log('SW зарегистрирован'))
        .catch((err) => console.log('SW ошибка:', err));
    }
  }, []);

  return null;
}