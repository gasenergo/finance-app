// src/components/pwa-register.tsx
'use client';

import { useEffect } from 'react';

export function PWARegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 
        'serviceWorker' in navigator && 
        process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js');
    }
  }, []);

  return null;
}