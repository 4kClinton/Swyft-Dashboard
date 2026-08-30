import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const devUrl = (env.VITE_CONVEX_SITE_URL_DEV || '').replace(/\/$/, '')
  const prodUrl = (env.VITE_CONVEX_SITE_URL_PROD || '').replace(/\/$/, '')
  // In dev, proxy to the dev Convex deployment so new routes are available without
  // deploying to production. In production build, proxy target isn't used.
  const convexSiteUrl = mode === 'development' ? (devUrl || prodUrl) : prodUrl

  return {
    plugins: [react(), tailwindcss()],
    server: {
      hmr: { protocol: 'ws', host: 'localhost' },
      proxy: {
        // Legacy single-env proxy (AppUpdates, and Pricing's default path).
        '/convex-proxy': {
          target: convexSiteUrl,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/convex-proxy/, ''),
        },
        // Explicit per-environment proxies so pages with a DEV/PROD toggle can
        // read either deployment from localhost without hitting CORS.
        '/convex-dev': {
          target: devUrl || prodUrl,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/convex-dev/, ''),
        },
        '/convex-prod': {
          target: prodUrl,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/convex-prod/, ''),
        },
      },
    },
  }
})
