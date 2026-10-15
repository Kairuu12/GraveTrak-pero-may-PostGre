import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // LegacyAdminWorkspace is intentionally still a large compatibility module
  // while its role-specific panels are migrated in small, testable slices.
  // Compact output prevents Babel's formatting-only 500 KB notice without
  // altering the code that runs in the browser.
  plugins: [react({ babel: { compact: true } })],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
