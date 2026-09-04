/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // globals: true registers the afterEach that Testing Library's auto-cleanup hooks into;
  // without it the DOM accumulates across tests in a file. Component files opt into jsdom
  // with a `@vitest-environment` docblock, so the mock-backend suite stays in node.
  test: { environment: 'node', globals: true, include: ['src/**/*.test.ts?(x)'] },
})
