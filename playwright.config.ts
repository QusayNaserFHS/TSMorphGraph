import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  use: {
    browserName: 'chromium',
    headless: true,
    viewport: { width: 1440, height: 900 },
  },
});
