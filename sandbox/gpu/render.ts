import {
  Camera2D,
  ClearCommand,
  Color,
  Draw2DCommand,
  type GraphicMaterial,
  GraphicMesh2D,
  GraphicVertex2D,
  Image,
  ImageTexture,
  Matrix3x2,
  RenderContext,
  RenderTarget,
  TextureAddressMode,
  TextureBinding,
  TextureFilter,
  TextureSampler,
  Vector2,
  Viewport,
  WebGlBackend,
} from '@dotm4x/fable'

const canvas = document.querySelector('#scene')
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('The GPU test canvas is missing.')
}

const backend = new WebGlBackend({ canvas })
const camera = new Camera2D()
const target = new RenderTarget(new Vector2(192, 192))
const checker = createCheckerImage()
const checkerSampler = new TextureSampler({
  minFilter: TextureFilter.nearest,
  magFilter: TextureFilter.nearest,
  addressU: TextureAddressMode.clampToEdge,
  addressV: TextureAddressMode.clampToEdge,
})
const checkerMaterial = backend.createMaterial([
  new TextureBinding(new ImageTexture(checker), checkerSampler),
])
const targetMaterial = backend.createMaterial([
  new TextureBinding(target, new TextureSampler({ minFilter: TextureFilter.nearest })),
])

backend.beginFrame()
try {
  backend.render([new ClearCommand(new Color('#1a1f2e'))], undefined, target)
  backend.render(
    [quad(checkerMaterial, 192, 192, true), triangle(checkerMaterial)],
    new RenderContext(0, camera, new Viewport(new Vector2(0, 0), new Vector2(192, 192))),
    target,
  )
  backend.render([new ClearCommand(new Color('#000000'))])
  backend.render(
    [quad(targetMaterial, 256, 256, false)],
    new RenderContext(0, camera, backend.viewport),
  )
} finally {
  backend.endFrame()
}

document.body.dataset.ready = 'ready'
document.body.dataset.drawCalls = String(backend.stats.drawCalls)
document.body.dataset.batches = String(backend.stats.batches)

function createCheckerImage(): Image {
  const size = 64
  const cell = 8
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const offset = (y * size + x) * 4
      const odd = (Math.floor(x / cell) + Math.floor(y / cell)) % 2 === 1
      data.set(odd ? [242, 146, 32, 255] : [46, 92, 196, 255], offset)
    }
  }

  return new Image(size, size, data)
}

function quad(
  material: GraphicMaterial,
  width: number,
  height: number,
  upright: boolean,
): Draw2DCommand {
  const left = -width / 2
  const right = width / 2
  const top = -height / 2
  const bottom = height / 2
  const [near, far] = upright ? [0, 1] : [1, 0]
  const mesh = new GraphicMesh2D(
    [
      new GraphicVertex2D(new Vector2(left, top), new Vector2(0, near), Color.white),
      new GraphicVertex2D(new Vector2(right, top), new Vector2(1, near), Color.white),
      new GraphicVertex2D(new Vector2(right, bottom), new Vector2(1, far), Color.white),
      new GraphicVertex2D(new Vector2(left, bottom), new Vector2(0, far), Color.white),
    ],
    [0, 1, 2, 0, 2, 3],
  )

  return new Draw2DCommand({ mesh, material, transform: Matrix3x2.identity })
}

function triangle(material: GraphicMaterial): Draw2DCommand {
  const mesh = new GraphicMesh2D([
    new GraphicVertex2D(new Vector2(-60, -50), new Vector2(0, 0), Color.red),
    new GraphicVertex2D(new Vector2(60, -50), new Vector2(1, 0), Color.green),
    new GraphicVertex2D(new Vector2(0, 60), new Vector2(0.5, 1), Color.blue),
  ])

  return new Draw2DCommand({ mesh, material, transform: Matrix3x2.rotation(0.3), order: 1 })
}
