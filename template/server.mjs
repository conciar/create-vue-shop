#!/usr/bin/env node
// Production server for the Conciar storefront.
//
// `vite dev` injects the secret API key via its proxy and rewrites the PSP's
// POST return into a GET — but that machinery only exists in the dev server.
// This file reproduces both for production, with zero runtime dependencies
// (Node built-ins only), so `npm run build && npm start` is genuinely shippable:
//
//   • serves the static build in ./dist (with SPA history fallback)
//   • proxies /api/* to CONCIAR_API_URL, injecting X-Api-Key / X-Sales-Channel
//     server-side — the secret key is never sent to the browser
//   • converts the Buckaroo POST payment-return into a GET redirect so the SPA
//     can boot and read the status params from the URL
//
// Configure via real environment variables (preferred in production) or a
// .env.local file in this directory (read automatically, never overriding the
// real environment). Listens on $PORT (default 3000).
import { createServer, request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { existsSync, readFileSync, createReadStream, statSync } from 'node:fs'
import { join, normalize, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const DIST = join(HERE, 'dist')

// ─── Env (real environment wins; .env.local fills the gaps) ──────────────────
function loadDotEnv(file) {
  if (!existsSync(file)) return
  for (const raw of readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let val = line.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = val
  }
}
loadDotEnv(join(HERE, '.env.local'))
loadDotEnv(join(HERE, '.env'))

const PORT = Number(process.env.PORT) || 3000
const API_URL = process.env.CONCIAR_API_URL || ''
const API_KEY = process.env.CONCIAR_API_KEY || ''
const SALES_CHANNEL = process.env.CONCIAR_SALES_CHANNEL_KEY || ''

if (!API_URL) {
  console.warn('⚠ CONCIAR_API_URL is not set — /api requests will fail. Set it in the environment or .env.local.')
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
}

// ─── /api proxy: inject the secret key server-side, strip the /api prefix ────
function proxyApi(req, res) {
  if (!API_URL) {
    res.writeHead(502, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'CONCIAR_API_URL not configured' }))
    return
  }
  const target = new URL(API_URL)
  const path = req.url.replace(/^\/api/, '') || '/'
  const isHttps = target.protocol === 'https:'
  const driver = isHttps ? httpsRequest : httpRequest

  const headers = { ...req.headers }
  delete headers.host
  delete headers['content-length'] // re-derived by the proxy request
  headers['X-Api-Key'] = API_KEY
  headers['X-Sales-Channel'] = SALES_CHANNEL

  const upstream = driver(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || (isHttps ? 443 : 80),
      method: req.method,
      path: target.pathname.replace(/\/$/, '') + path,
      headers: { ...headers, host: target.host },
    },
    upRes => {
      res.writeHead(upRes.statusCode || 502, upRes.headers)
      upRes.pipe(res)
    },
  )
  upstream.on('error', err => {
    res.writeHead(502, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Upstream request failed', detail: String(err?.message ?? err) }))
  })
  req.pipe(upstream)
}

// ─── Static files + SPA fallback ─────────────────────────────────────────────
function serveStatic(req, res) {
  // Resolve safely inside DIST; default to index.html for "/".
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0])
  let filePath = normalize(join(DIST, urlPath))
  if (!filePath.startsWith(DIST)) {
    res.writeHead(403).end('Forbidden')
    return
  }
  if (existsSync(filePath) && statSync(filePath).isDirectory()) filePath = join(filePath, 'index.html')

  if (!existsSync(filePath)) {
    // SPA history fallback: unknown non-asset paths get index.html.
    if (extname(urlPath)) { res.writeHead(404).end('Not found'); return }
    filePath = join(DIST, 'index.html')
    if (!existsSync(filePath)) {
      res.writeHead(404).end('Build not found — run `npm run build` first.')
      return
    }
  }
  const type = MIME[extname(filePath)] || 'application/octet-stream'
  res.writeHead(200, { 'Content-Type': type })
  createReadStream(filePath).pipe(res)
}

const server = createServer((req, res) => {
  const url = req.url || '/'

  if (url.startsWith('/api')) return proxyApi(req, res)

  // PSP return: Buckaroo POSTs to the return URL. Convert to a GET redirect so
  // the SPA can load and the Vue route can read the status params.
  if (req.method === 'POST') {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => {
      const qs = new URLSearchParams(body).toString()
      const sep = url.includes('?') ? '&' : '?'
      res.writeHead(302, { Location: qs ? `${url}${sep}${qs}` : url })
      res.end()
    })
    return
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405).end('Method not allowed')
    return
  }

  serveStatic(req, res)
})

server.listen(PORT, () => {
  console.log(`Conciar storefront listening on http://localhost:${PORT}`)
  console.log(API_URL ? `Proxying /api → ${API_URL}` : '(no CONCIAR_API_URL — /api disabled)')
})
