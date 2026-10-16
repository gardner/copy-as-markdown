import process from 'node:process';
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test/security-browser',
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 15_000,
  use: { headless: true },
});
