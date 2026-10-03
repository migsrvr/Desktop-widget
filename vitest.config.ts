import { defineConfig } from 'vitest/config';

export default defineConfig({
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
