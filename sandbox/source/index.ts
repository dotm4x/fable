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

const element = document.querySelector('canvas')
if (!(element instanceof HTMLCanvasElement)) {
  throw new Error('The sandbox canvas is missing.')
}
const canvas: HTMLCanvasElement = element

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

main().catch((error: unknown) => {
  console.error(error)
})
