import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@workpulse/shared': fileURLToPath(new URL('./shared/types/events.ts', import.meta.url)),
    },
  },
  test: {
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/screen-worker/**',
      '**/openclaw-bridge/**',
      '**/src-tauri/**',
    ],
  },
});
