import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { chromium } from '@playwright/test'

const root = fileURLToPath(new URL('..', import.meta.url))
const port = 4182
const counts = [100, 500, 1000, 2000, 5000, 10000]
const rendererInfo = `(() => {
  const canvas = document.createElement('canvas')
  const gl = canvas.getContext('webgl2')
  const extension = gl === null ? null : gl.getExtension('WEBGL_debug_renderer_info')
  return {
    renderer: extension === null ? 'unknown' : gl.getParameter(extension.UNMASKED_RENDERER_WEBGL),
    vendor: extension === null ? 'unknown' : gl.getParameter(extension.UNMASKED_VENDOR_WEBGL),
    version: gl === null ? 'none' : gl.getParameter(gl.VERSION),
  }
})()`

const server = spawn('pnpm', ['exec', 'vite', '--port', String(port), '--strictPort'], {
  cwd: root,
  stdio: 'ignore',
})

async function waitForServer(url) {
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {
      // Server still starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  throw new Error('The sandbox server did not start.')
}

function format(value, digits = 2) {
  return Number(value).toFixed(digits).padStart(8)
}

try {
  await waitForServer(`http://localhost:${String(port)}/`)
  const browser = await chromium.launch()
  const page = await browser.newPage({
    viewport: { width: 900, height: 700 },
    deviceScaleFactor: 1,
  })
  const info = await page.evaluate(rendererInfo)
  console.log(`WebGL: ${String(info.renderer)} (${String(info.vendor)})`)
  console.log(`Version: ${String(info.version)}`)
  console.log('')
  console.log('mode     balls    ms/frame      fps   draws   commands')
  console.log('--------------------------------------------------------')

  for (const mode of ['single', 'nodes']) {
    for (const count of counts) {
      const frames = count >= 5000 ? 90 : 180
      const url = `http://localhost:${String(port)}/?scene=balls&mode=${mode}&count=${String(count)}&bench=render&frames=${String(frames)}`
      await page.goto(url)
      await page.waitForFunction('document.body.dataset.bench === "done"', undefined, {
        timeout: 180000,
      })
      const data = await page.evaluate('window.ballsRenderBenchmark')
      console.log(
        `${mode.padEnd(8)} ${String(count).padStart(6)} ${format((data.elapsed * 1000) / data.frames)}` +
          ` ${format(data.fps, 1)} ${String(data.drawCalls).padStart(7)} ${String(data.commands).padStart(10)}`,
      )
    }
  }

  await browser.close()
} finally {
  server.kill()
}
