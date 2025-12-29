// src/app/manifest.ts
import type { MetadataRoute } from 'next'
 
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'FinTrack - Финансовый учёт',
    short_name: 'FinTrack',
    description: 'Финансовый учёт студии дизайнеров',
    start_url: '/',
    display: 'standalone',
    background_color: '#f9fafb',
    theme_color: '#2563eb',
    orientation: 'portrait',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}