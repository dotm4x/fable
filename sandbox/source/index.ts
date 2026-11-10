import {
  AssetsModule,
  type GraphicMaterial,
  type Image,
  ImageImporter,
  ImageTexture,
  type RenderBackend,
  TextureBinding,
  TextureSampler,
  WebGlBackend,
} from '@dotm4x/fable'

import { Sandbox } from './sandbox.js'
import { type BallsBenchmark } from './scenes/bench/scene.js'

declare global {
  interface Window {
    ballsRenderBenchmark?: BallsBenchmark
  }
}

const element = document.querySelector('canvas')
if (!(element instanceof HTMLCanvasElement)) {
  throw new Error('The sandbox canvas is missing.')
}

const canvas: HTMLCanvasElement = element

window.addEventListener('keydown', (event) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
    event.preventDefault()
  }
})

function selectBackend(): RenderBackend {
  return new WebGlBackend({ canvas })
}

async function createMaterial(
  backend: RenderBackend,
  assets: AssetsModule,
): Promise<GraphicMaterial> {
  const image = await assets.load<Image>('/images/uv_grid.jpg')

  return backend.createMaterial([
    new TextureBinding(new ImageTexture(image.value), new TextureSampler({ mipmaps: true })),
  ])
}

async function main(): Promise<void> {
  const backend = selectBackend()
  const assets = new AssetsModule({ importers: [new ImageImporter()] })
  const material = await createMaterial(backend, assets)
  const game = new Sandbox(backend, material, assets)
  game.start()
  game.time.run()
  measureRender(game)

  let running = true
  const toggle = document.querySelector('#toggle')
  toggle?.addEventListener('click', () => {
    running = !running
    if (running) {
      game.start()
      game.time.run()
    } else {
      game.stop()
    }

    if (toggle instanceof HTMLButtonElement) toggle.textContent = running ? 'Pause' : 'Resume'
  })
}

function measureRender(game: Sandbox): void {
  const params = new URLSearchParams(globalThis.location.search)
  const backend = game.renderer.backend
  if (params.get('bench') !== 'render' || !(backend instanceof WebGlBackend)) return
  const requested = Number(params.get('frames') ?? 240)
  const frames = Number.isFinite(requested) ? Math.max(1, Math.floor(requested)) : 240
  for (let index = 0; index < 20; index++) game.renderer.render(1 / 60)
  backend.readPixels()
  const started = performance.now()
  for (let index = 0; index < frames; index++) game.renderer.render(1 / 60)
  backend.readPixels()
  const elapsed = (performance.now() - started) / 1000
  window.ballsRenderBenchmark = {
    mode: params.get('mode') === 'nodes' ? 'nodes' : 'single',
    count: Number(params.get('count') ?? 0),
    nodes: 0,
    frames,
    elapsed,
    fps: frames / Math.max(elapsed, 0.000001),
    drawCalls: backend.stats.drawCalls,
    commands: backend.stats.commands,
  }
  document.body.dataset.bench = 'done'
}

main().catch((error: unknown) => {
  console.error(error)
})
