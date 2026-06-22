import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  // loadEnv with '' prefix loads ALL vars — including non-VITE_ ones.
  // These are only available in this config file (server-side), never in the browser bundle.
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      vue(),
      tailwindcss(),
      // PSP return handler: Buckaroo POSTs to the return URL after payment.
      // This middleware converts the POST body to a GET redirect so the SPA
      // can load and the Vue route can read the status params from the URL.
      {
        name: 'psp-post-to-get',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (req.method !== 'POST' || req.url?.startsWith('/api')) return next()
            let body = ''
            req.on('data', chunk => { body += chunk.toString() })
            req.on('end', () => {
              const qs = new URLSearchParams(body).toString()
              const sep = req.url!.includes('?') ? '&' : '?'
              const location = qs ? `${req.url}${sep}${qs}` : req.url!
              res.writeHead(302, { Location: location })
              res.end()
            })
          })
        },
      },
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    },
    server: {
      port: 3001,
      allowedHosts: ['cellier.local'],
      // Proxy /api/* to Conciar, injecting the secret key server-side.
      // The key is never sent to the browser.
      proxy: env.CONCIAR_API_URL
        ? {
            '/api': {
              target: env.CONCIAR_API_URL,
              changeOrigin: true,
              rewrite: path => path.replace(/^\/api/, ''),
              configure(proxy) {
                proxy.on('proxyReq', proxyReq => {
                  proxyReq.setHeader('X-Api-Key',       env.CONCIAR_API_KEY || '')
                  proxyReq.setHeader('X-Sales-Channel', env.CONCIAR_SALES_CHANNEL_KEY || '')
                })
              },
            },
          }
        : undefined,
    },
  }
})
