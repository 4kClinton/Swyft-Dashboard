import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // In dev, proxy to the dev Convex deployment so new routes are available without
  // deploying to production. In production build, proxy target isn't used.
  const convexSiteUrl = mode === 'development'
    ? (env.VITE_CONVEX_SITE_URL_DEV || env.VITE_CONVEX_SITE_URL_PROD || '').replace(/\/$/, '')
    : (env.VITE_CONVEX_SITE_URL_PROD || '').replace(/\/$/, '')

  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        '/convex-proxy': {
          target: convexSiteUrl,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/convex-proxy/, ''),
        },
      },
    },
  }
})
