import { expect, test } from '@playwright/test'

test('renders the reference scene through the WebGL pipeline', async ({ page }) => {
  await page.goto('/gpu/index.html')
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'ready')

  const drawCalls = Number(await page.locator('body').getAttribute('data-draw-calls'))
  const commands = Number(await page.locator('body').getAttribute('data-commands'))
  const center = await page.locator('body').getAttribute('data-center')

  expect(drawCalls).toBeGreaterThan(0)
  expect(commands).toBeGreaterThanOrEqual(drawCalls)
  expect(center).not.toBe('0,0,0,0')
  await expect(page.locator('#scene')).toHaveScreenshot('gpu-scene.png')
})
