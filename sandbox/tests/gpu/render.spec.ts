import { expect, test } from '@playwright/test'

test('renders the reference scene through the WebGL pipeline', async ({ page }) => {
  await page.goto('/gpu/index.html')
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'ready')

  expect(Number(await page.locator('body').getAttribute('data-draw-calls'))).toBeGreaterThan(0)
  await expect(page.locator('#scene')).toHaveScreenshot('gpu-scene.png')
})
