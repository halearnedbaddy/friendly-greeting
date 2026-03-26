import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [
      react(),
      mode === 'development' && componentTagger(),
      VitePWA({
        registerType: 'prompt',
        includeAssets: ['payloom-icon.png', 'pwa-icon-192.png', 'pwa-icon-512.png'],
        manifest: {
          name: 'PayLoom Instants',
          short_name: 'PayLoom',
          description: 'PayLoom Instants - Secure payment platform for safe transactions in Africa.',
          theme_color: '#250e52',
          background_color: '#250e52',
          display: 'standalone',
          orientation: 'portrait',
          scope: '/',
          start_url: '/',
          categories: ['finance', 'business'],
          shortcuts: [
            {
              name: 'Seller Dashboard',
              short_name: 'Seller',
              url: '/seller',
              icons: [{ src: '/pwa-icon-192.png', sizes: '192x192' }]
            },
            {
              name: 'Buyer Dashboard',
              short_name: 'Buyer',
              url: '/buyer',
              icons: [{ src: '/pwa-icon-192.png', sizes: '192x192' }]
            }
          ],
          icons: [
            {
              src: '/pwa-icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: '/pwa-icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'maskable'
            },
            {
              src: '/pwa-icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: '/pwa-icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,jpeg,jpg,woff2}'],
          navigateFallbackDenylist: [/^\/~oauth/],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'supabase-cache',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24
                }
              }
            },
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365
                }
              }
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-webfonts',
                expiration: {
                  maxEntries: 30,
                  maxAgeSeconds: 60 * 60 * 24 * 365
                }
              }
            }
          ]
        },
        devOptions: {
          enabled: true
        }
      })
    ].filter(Boolean),
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-supabase': ['@supabase/supabase-js'],
            'vendor-ui': ['lucide-react', 'clsx', 'tailwind-merge', 'class-variance-authority'],
            'vendor-recharts': ['recharts'],
          },
        },
      },
      chunkSizeWarningLimit: 600,
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    define: {
      // Ensure environment variables are available
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL || 'https://krkybhborwvcbjzjcghw.supabase.co'),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtya3liaGJvcnd2Y2JqempjZ2h3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0OTYwNDksImV4cCI6MjA4NzA3MjA0OX0.mwm0aTd9ZBltJD5VgOFN7vZ6jibpKsF8dGdcSwOg1cw'),
    },
    server: {
      host: "0.0.0.0",
      port: 5000,
      allowedHosts: true,
      proxy: {
        '/api': {
          target: 'http://localhost:8000',
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
