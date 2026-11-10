import { describe, expect, it } from 'vitest'

import {
  Camera2D,
  Color,
  Draw2DCommand,
  type Drawable,
  DrawData,
  GraphicMesh2D,
  GraphicVertex2D,
  RenderContext,
  RenderPassPriority,
  RenderSpace,
  RenderTarget,
  SpaceRenderPass,
  spaceRenderPassIdentifier,
  Vector2,
} from '../../../../source/index.js'

import { createTestMaterial, RecordingBackend } from './recording-backend.js'

function createMesh(): GraphicMesh2D {
  return new GraphicMesh2D([
    new GraphicVertex2D(new Vector2(0, 0), new Vector2(0, 0), Color.white),
    new GraphicVertex2D(new Vector2(1, 0), new Vector2(1, 0), Color.white),
    new GraphicVertex2D(new Vector2(0, 1), new Vector2(0, 1), Color.white),
  ])
}

class TestDrawable implements Drawable {
  public readonly order: string[]
  public readonly name: string
  private readonly _target: RenderTarget | undefined

  public constructor(name: string, order: string[], target?: RenderTarget) {
    this.name = name
    this.order = order
    this._target = target
  }

  public draw(): DrawData {
    this.order.push(this.name)
    if (this._target === undefined) return new DrawData([])

    return new DrawData([
      new Draw2DCommand({
        mesh: createMesh(),
        material: createTestMaterial(),
        transform: new Camera2D().localTransform,
      }),
    ])
  }
}

describe('SpaceRenderPass', () => {
  it('draws spaces with their camera, viewport and target', () => {
    const backend = new RecordingBackend()
    const camera = new Camera2D()
    const target = new RenderTarget(new Vector2(64, 32))
    const order: string[] = []
    const space = new RenderSpace({
      identifier: 'space',
      camera,
      target,
      entries: [new TestDrawable('space', order, target)],
    })

    backend.beginFrame()
    new SpaceRenderPass().execute({
      backend,
      deltaTime: 0.5,
      clearColor: Color.black,
      spaces: [space],
    })
    backend.endFrame()

    expect(order).toEqual(['space'])
    expect(backend.rendered[0]?.[0]).toBeInstanceOf(Draw2DCommand)
    expect(backend.targets).toEqual([target])
    expect(backend.contexts[0]).toBeInstanceOf(RenderContext)
    expect(backend.contexts[0]?.deltaTime).toBe(0.5)
    expect(backend.contexts[0]?.camera).toBe(camera)
    expect(backend.contexts[0]?.viewport.size).toEqual(new Vector2(64, 32))

    target.destroy()
    space.destroy()
  })

  it('exposes its identifier and default priority', () => {
    const pass = new SpaceRenderPass()

    expect(pass.identifier).toBe(spaceRenderPassIdentifier)
    expect(pass.priority).toBe(RenderPassPriority.normal)
    pass.destroy()
  })
})
