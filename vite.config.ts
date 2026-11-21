import { defineConfig, type Plugin } from 'vite';
import { resolve } from 'path';
import { execSync } from 'child_process';

let version: string;
try {
  // Exactly on a tag: use the clean tag name (e.g. "0.3.1").
  version = execSync('git describe --tags --exact-match')
    .toString()
    .trim()
    .replace(/^v/, '');
} catch {
  try {
    // Between tags: tag + commit count + hash (e.g. "0.3.1-2-gabc1234").
    version = execSync('git describe --tags --long --always')
      .toString()
      .trim()
      .replace(/^v/, '');
  } catch {
    version = '0.0.0-development';
  }
}

// No dev server and no dev proxy. The only local door is gtfs-zone-dev-stack's
// oauth2-proxy at :4180, which serves this `dist/` through nginx and routes
// /api to gtfs-zone-rt-api on the same origin; `pnpm dev` is a watch build into that
// directory. A vite server would have to forge the X-Auth-Request-* headers,
// and everything auth-shaped (the cookie, session expiry, the CSRF header on a
// write, SSE through the proxy, sign-out) is exactly what a forgery cannot
// show.
// Restarts the dev server when pnpm-lock.yaml changes. A dependency bump moves
// gtfs-zone-web-common to a new store path, and cached transforms (mainly the
// shared stylesheet's CSS @import) keep serving the old copy until a restart.
const restartOnLockfile: Plugin = {
  name: 'restart-on-lockfile',
  apply: 'serve',
  configureServer(server) {
    const lockfile = resolve(__dirname, 'pnpm-lock.yaml');
    server.watcher.add(lockfile);
    server.watcher.on('change', (file) => {
      if (file === lockfile) {
        server.config.logger.info('[restart-on-lockfile] pnpm-lock.yaml changed, restarting');
        void server.restart();
      }
    });
  },
};

export default defineConfig({
  plugins: [restartOnLockfile],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  root: 'src',
  publicDir: '../public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'src/index.html'),
    },
  },
  css: {
    postcss: './postcss.config.js',
  },
  resolve: {
    alias: {
      'gtfs-zone-web-common': resolve(
        __dirname,
        'node_modules/gtfs-zone-web-common/src'
      ),
    },
  },
  optimizeDeps: {
    include: ['maplibre-gl', '@maplibre/geojson-vt', '@maplibre/vt-pbf', 'jszip', 'papaparse'],
    // gtfs-zone-web-common ships raw .ts; let vite transform it as source
    exclude: ['gtfs-zone-web-common'],
  },
});
