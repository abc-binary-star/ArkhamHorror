import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const { slimCards } = createRequire(import.meta.url)('./scripts/slim-cards.cjs')

// Serves homebrew campaign images (frontend/homebrew/<campaign>/img/*) at
// their CDN paths (/img/arkham/homebrew/<campaign>/*) so a local
// VITE_ASSET_HOST keeps working in dev; production loads them from S3, synced
// there by `make sync-images`.
const homebrewImages = () => ({
  name: 'homebrew-images',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const match = req.url?.match(/^\/img\/arkham\/homebrew\/([a-z0-9-]+)\/(.+)$/)
      if (!match) return next()
      const homebrewDir = fileURLToPath(new URL('./homebrew', import.meta.url))
      const campaign = match[1]
      const file = path.join(homebrewDir, campaign, 'img', decodeURIComponent(match[2]).split('?')[0])
      if (!file.startsWith(path.join(homebrewDir, campaign, 'img')) || !fs.existsSync(file)) return next()
      res.setHeader('Content-Type', file.endsWith('.avif') ? 'image/avif' : file.endsWith('.jpg') ? 'image/jpeg' : 'image/png')
      fs.createReadStream(file).pipe(res)
    })
  },
})

// Lazy mirror of the CDN image assets, active for `vite serve` and `vite
// preview`. From this network the CloudFront edge misses (~6s per image, no Cache-Control), so every page
// switch re-waits on dozens of images. The first request for a path is fetched
// upstream once and cached under node_modules/.cache (never committed); later
// requests stream from disk. Needs VITE_ASSET_HOST= in .env.development.local
// so imgsrc() emits local /img/arkham/* URLs. Homebrew paths are left to the
// homebrewImages plugin above.
const CDN_ASSET_HOST = 'https://assets.arkhamhorror.app'
const assetMirror = () => {
  const install = (server, preview = false) => {
    const cacheDir = path.join(server.config.root, 'node_modules', '.cache', 'arkham-assets')
    const inflight = new Map()
    const types = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.avif': 'image/avif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
    }

    const fetchIntoCache = (rel) => {
      const file = path.join(cacheDir, rel)
      let task = inflight.get(rel)
      if (!task) {
        task = (async () => {
          const upstream = await fetch(`${CDN_ASSET_HOST}/img/arkham/${rel}`)
          if (!upstream.ok) throw new Error(`upstream ${upstream.status}`)
          const body = Buffer.from(await upstream.arrayBuffer())
          await fs.promises.mkdir(path.dirname(file), { recursive: true })
          await fs.promises.writeFile(`${file}.tmp`, body)
          await fs.promises.rename(`${file}.tmp`, file)
        })()
        inflight.set(rel, task)
        task.then(
          () => inflight.delete(rel),
          () => inflight.delete(rel),
        )
      }
      return task.then(() => file)
    }

    server.middlewares.use(async (req, res, next) => {
      if (req.method !== 'GET') return next()
      const url = (req.url || '').split('?')[0]
      if (!url.startsWith('/img/arkham/') || url.startsWith('/img/arkham/homebrew/')) return next()
      const rel = decodeURIComponent(url.slice('/img/arkham/'.length))
      if (!rel || rel.includes('..')) return next()
      // Serve checked-in UI images (and explicitly downloaded mirrors) before
      // consulting the CDN. Preview reads from the configured build output.
      const publicRoot = preview
        ? path.resolve(server.config.root, server.config.build.outDir)
        : path.resolve(server.config.root, server.config.publicDir)
      const localFile = path.join(publicRoot, 'img', 'arkham', rel)
      if (fs.existsSync(localFile) && fs.statSync(localFile).isFile()) return next()
      const file = path.join(cacheDir, rel)
      if (!file.startsWith(cacheDir + path.sep)) return next()
      try {
        if (!fs.existsSync(file)) await fetchIntoCache(rel)
      } catch {
        // Upstream miss or network failure: answer 404 here rather than
        // next(), which the SPA fallback would turn into a 200 index.html.
        res.statusCode = 404
        res.end()
        return
      }
      if (!fs.existsSync(file)) return next()
      res.setHeader('Content-Type', types[path.extname(file).toLowerCase()] || 'application/octet-stream')
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
      fs.createReadStream(file).pipe(res)
    })
  }
  return { name: 'cdn-asset-mirror', configureServer: server => install(server), configurePreviewServer: server => install(server, true) }
}

// The embedded arkham.build app lives in public/build/. Vite's SPA fallback
// would swallow deep links like /build/deck/edit/<id> into the game's
// index.html (browsers send Accept: text/html), so this middleware serves the
// builder's own dist — file when it exists, builder index.html otherwise —
// ahead of the internal middlewares.
const builderApp = () => {
  const root = path.join(fileURLToPath(new URL('./public/build', import.meta.url)))
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.xml': 'application/xml',
    '.webmanifest': 'application/manifest+json',
  }
  const install = (server) => {
    server.middlewares.use((req, res, next) => {
      const url = (req.url || '').split('?')[0]
      if (url !== '/build' && !url.startsWith('/build/')) return next()
      const rel = url === '/build' ? '' : decodeURIComponent(url.slice('/build/'.length))
      let file = path.join(root, rel)
      if (!file.startsWith(root + path.sep) && file !== root) return next()
      if (rel === '' || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        file = path.join(root, 'index.html')
      }
      res.setHeader('Content-Type', types[path.extname(file).toLowerCase()] || 'application/octet-stream')
      res.setHeader('Cache-Control', path.basename(file) === 'index.html' ? 'no-cache' : 'public, max-age=31536000, immutable')
      fs.createReadStream(file).pipe(res)
    })
  }
  return { name: 'embedded-builder', configureServer: install, configurePreviewServer: install }
}

// Serves the slimmed card data (/cards/cards_<lang>.json) that dbCards.ts
// fetches. `npm run build` writes those files via slim-cards.cjs, but nothing
// generates them for `vite dev`, so without this the SPA fallback answers with
// index.html and every card lookup fails on `Unexpected token '<'`. Slim the
// source export on demand instead, cached per language for the server's life.
const cardData = () => {
  const cache = new Map()

  return {
    name: 'card-data',
    configureServer(server) {
      const publicDir = fileURLToPath(new URL('./public', import.meta.url))

      server.middlewares.use((req, res, next) => {
        const match = req.url?.split('?')[0].match(/^\/cards\/(cards_[a-z]+(?:-[a-z]+)?\.json)$/)
        if (!match) return next()

        const file = match[1]
        // A generated copy (from a previous build) wins, so dev matches prod.
        if (fs.existsSync(path.join(publicDir, 'cards', file))) return next()

        const source = path.join(publicDir, file)
        if (!fs.existsSync(source)) return next()

        const mtime = fs.statSync(source).mtimeMs
        let cached = cache.get(file)
        if (!cached || cached.mtime !== mtime) {
          const raw = fs.readFileSync(source, 'utf8').trim()
          if (!raw) return next()
          cached = { mtime, json: JSON.stringify(slimCards(JSON.parse(raw))) }
          cache.set(file, cached)
        }

        res.setHeader('Content-Type', 'application/json')
        res.end(cached.json)
      })
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    homebrewImages(),
    assetMirror(),
    builderApp(),
    cardData(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@homebrew': fileURLToPath(new URL('./homebrew', import.meta.url))
    }
  },
  server: {
    port: 8080,
    host: true,
    proxy: {
      "^/api": {
        target: "http://127.0.0.1:3002",
        changeOrigin: true,
        secure: false,
        ws: true
      },
      "^/health": {
        target: "http://127.0.0.1:3002",
        changeOrigin: true,
        secure: false,
        ws: false
      },
      // The embedded arkham.build app under public/build/ reads its card
      // database from api.arkham.build; same-origin path keeps its CORS
      // handling identical to the production nginx deployment.
      "^/build-api": {
        target: "https://api.arkham.build",
        changeOrigin: true,
        secure: true,
        ws: false,
        rewrite: (p) => p.replace(/^\/build-api/, "")
      }
    }
  }
})
