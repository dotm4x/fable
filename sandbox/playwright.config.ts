import { defineConfig, devices } from '@playwright/test'

const port = 4173

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: 'list',
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01 } },
  use: {
    baseURL: `http://localhost:${String(port)}`,
    deviceScaleFactor: 1,
    viewport: { width: 400, height: 400 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], deviceScaleFactor: 1 } }],
  webServer: {
    command: `pnpm dev --port ${String(port)} --strictPort`,
    url: `http://localhost:${String(port)}/gpu/index.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
