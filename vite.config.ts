import { defineConfig, type Plugin } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { cpSync, createReadStream, existsSync, statSync } from 'node:fs'
import path from 'node:path'

// MathJax (math on shared pages) is served from this site, not a CDN, so the site works for
// any campus that hosts it and visitors' browsers make no third-party requests for it.
const MATHJAX_BUNDLE = path.resolve('node_modules/@mathjax/src/bundle')
const MATHJAX_FONT = path.resolve('node_modules/@mathjax/mathjax-newcm-font')
const MOUNTS: [string, string][] = [
  ['/mathjax/fonts/mathjax-newcm-font/', MATHJAX_FONT],
  ['/mathjax/', MATHJAX_BUNDLE],
]
const TYPES: Record<string, string> = {
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
}

function mathjaxAssets(): Plugin {
  let outDir = 'dist'
  let isBuild = false
  return {
    name: 'mathjax-assets',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir)
      isBuild = config.command === 'build'
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = decodeURIComponent((req.url ?? '').split('?')[0])
        const mount = MOUNTS.find(([prefix]) => url.startsWith(prefix))
        if (!mount) return next()
        const [prefix, dir] = mount
        const file = path.resolve(dir, url.slice(prefix.length))
        if (!file.startsWith(dir + path.sep) || !existsSync(file) || !statSync(file).isFile()) {
          res.statusCode = 404
          res.end()
          return
        }
        res.setHeader('Content-Type', TYPES[path.extname(file)] ?? 'application/octet-stream')
        createReadStream(file).pipe(res)
      })
    },
    closeBundle() {
      // Vite also calls this when a dev server or vitest shuts down; copy only for `vite build`.
      if (!isBuild) return
      // Only what the browser loads: the TeX component, its extensions, the accessibility
      // components and speech worker with its rule files, and the CHTML font.
      const dest = path.join(outDir, 'mathjax')
      for (const entry of ['tex-chtml.js', 'a11y', 'input', 'output', 'ui', 'sre']) {
        cpSync(path.join(MATHJAX_BUNDLE, entry), path.join(dest, entry), { recursive: true })
      }
      for (const entry of ['chtml', 'chtml.js']) {
        cpSync(path.join(MATHJAX_FONT, entry), path.join(dest, 'fonts/mathjax-newcm-font', entry), {
          recursive: true,
        })
      }
      // Apache-2.0 asks for a copy of the license with redistributed files.
      cpSync(path.join(MATHJAX_BUNDLE, '..', 'LICENSE'), path.join(dest, 'LICENSE'))
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), mathjaxAssets()],
  test: {
    // Most tests are plain logic and run in node. A component test opts in to a DOM with a
    // `// @vitest-environment jsdom` comment at the top of the file.
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
