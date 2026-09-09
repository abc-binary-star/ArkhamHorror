import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import fs from 'node:fs'
import path from 'node:path'

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

// Dev-only lazy mirror of the CDN image assets. From this network the
// CloudFront edge misses (~6s per image, no Cache-Control), so every page
// switch re-waits on dozens of images. The first request for a path is fetched
// upstream once and cached under node_modules/.cache (never committed); later
// requests stream from disk. Needs VITE_ASSET_HOST= in .env.development.local
// so imgsrc() emits local /img/arkham/* URLs. Homebrew paths are left to the
// homebrewImages plugin above.
const CDN_ASSET_HOST = 'https://assets.arkhamhorror.app'
const assetMirror = () => ({
  name: 'cdn-asset-mirror',
  apply: 'serve',
  configureServer(server) {
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
      res.setHeader('Cache-Control', 'public, max-age=86400')
      fs.createReadStream(file).pipe(res)
    })
  },
})

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    homebrewImages(),
    assetMirror(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@homebrew': fileURLToPath(new URL('./homebrew', import.meta.url))
    }
  },
  server: {
    port: 8080,
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
      }
    }
  }
})
