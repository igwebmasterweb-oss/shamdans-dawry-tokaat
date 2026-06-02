import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'الشمعدان × كأس العالم 2026',
    short_name: 'دوري توقعات الشمعدان',
    description: 'توقع نتايج كأس العالم مع الشمعدان',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#070809',
    theme_color: '#d9b25f',
    lang: 'ar',
    dir: 'rtl',
    categories: ['games', 'sports'],
    icons: [
      {
        src: '/logo-FF.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/logo-FF.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/logo-FF.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
