/// <reference types="vitest/config" />
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vite'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  // GitHub Pages serves the app under /anchorline/. The workflow sets this;
  // local dev and a root-hosted fork keep '/'.
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      '@': path.resolve(dirname, './src'),
    },
  },
  optimizeDeps: {
    // Vitest reloads mid-run when it discovers these late.
    include: ['blockstore-core', '@helia/unixfs', '@ipld/car'],
  },
  test: {
    projects: [
      {
        // `src/**/*.test.ts` also matches `*.browser.test.ts`, on purpose. The
        // seed script computes CIDs in Node and the app recomputes them in the
        // browser; if the two runtimes ever disagreed the demo would fail on
        // stage, so the CID suite runs in both.
        //
        // `*.files.test.ts` is excluded: those read the repository off disk and
        // are not unit tests. They run in the `files` project below.
        extends: true,
        test: {
          name: 'node',
          include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
          exclude: ['**/*.files.test.ts', '**/*.profile.test.ts', '**/node_modules/**'],
          environment: 'node',
        },
      },
      {
        // Reads filecoin-pin's Node entry, which does not exist in a browser
        // build. Not a browser test and not run in the browser project.
        extends: true,
        test: {
          name: 'profile',
          include: ['**/*.profile.test.ts'],
          exclude: ['**/node_modules/**'],
          environment: 'node',
        },
      },
      {
        extends: true,
        test: {
          name: 'files',
          include: ['**/*.files.test.ts'],
          exclude: ['**/node_modules/**'],
          environment: 'node',
        },
      },
      {
        extends: true,
        test: {
          name: 'browser',
          include: ['src/**/*.browser.test.ts'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
})
