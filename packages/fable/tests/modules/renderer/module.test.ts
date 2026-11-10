import { describe, expect, it } from 'vitest'

import {
  Camera2D,
  ClearCommand,
  Color,
  Draw2DCommand,
  type Drawable,
  type DrawCommand,
  type DrawContext,
  DrawData,
  Game,
  GraphicMaterial,
  GraphicMesh2D,
  GraphicVertex2D,
  RenderBackend,
  RendererModule,
  RenderPass,
  type RenderPassContext,
  RenderPassPriority,
  RenderSpace,
  RenderSpacePriority,
  type RenderStats,
  RenderTarget,
  Shader,
  ShaderLanguage,
  ShaderStage,
  Vector2,
  Viewport,
} from '../../../source/index.js'

class TestGame extends Game {}

class TestBackend extends RenderBackend {
  public readonly defaultMaterial: GraphicMaterial = createMaterial()
  public readonly events: string[] = []
  public readonly rendered: DrawCommand[][] = []
  public readonly contexts: (DrawContext | undefined)[] = []
  public readonly targets: (RenderTarget | undefined)[] = []
  public constructor() {
    super('test')
  }

  public get stats(): RenderStats {
    return { drawCalls: 0, batches: 0, commands: 0, textures: 0, targets: 0, textureBytes: 0 }
  }

  public get viewport(): Viewport {
    return new Viewport(new Vector2(0, 0), new Vector2(100, 50))
  }

  public createMaterial(): GraphicMaterial {
    return createMaterial()
  }

  protected override onBeginFrame(): void {
    this.events.push('begin')
  }

  protected override onEndFrame(): void {
    this.events.push('end')
  }

  protected override onRender(
    commands: readonly DrawCommand[],
    context: DrawContext | undefined,
    target: RenderTarget | undefined,
  ): void {
    this.rendered.push([...commands])
    this.contexts.push(context)
    this.targets.push(target)
  }
}

class TestPass extends RenderPass {
  public readonly contexts: RenderPassContext[] = []
  public readonly commandCounts: number[] = []

  public constructor(identifier: string, priority: RenderPassPriority) {
    super(identifier, priority)
  }

  public execute(context: RenderPassContext): void {
    this.throwIfDestroyed()
    this.contexts.push(context)
    this.commandCounts.push(
      context.backend instanceof TestBackend ? context.backend.rendered.length : -1,
    )
  }
}

class TestDrawable implements Drawable {
  public readonly order: string[]
  public readonly name: string

  public constructor(name: string, order: string[]) {
    this.name = name
    this.order = order
  }

  public draw(): DrawData {
    this.order.push(this.name)

    return new DrawData([])
  }
}

function createMaterial(): GraphicMaterial {
  return new GraphicMaterial({
    vertexShader: new Shader({
      code: 'vertex',
      language: ShaderLanguage.wgsl,
      stage: ShaderStage.vertex,
    }),
    fragmentShader: new Shader({
      code: 'fragment',
      language: ShaderLanguage.wgsl,
      stage: ShaderStage.fragment,
    }),
  })
}

function createMesh(): GraphicMesh2D {
  return new GraphicMesh2D([
    new GraphicVertex2D(new Vector2(0, 0), new Vector2(0, 0), Color.white),
    new GraphicVertex2D(new Vector2(1, 0), new Vector2(1, 0), Color.white),
    new GraphicVertex2D(new Vector2(0, 1), new Vector2(0, 1), Color.white),
  ])
}

describe('RendererModule', () => {
  it('clears the surface and draws spaces in priority order', () => {
    const backend = new TestBackend()
    const order: string[] = []
    const camera = new Camera2D()
    const low = new RenderSpace({
      identifier: 'low',
      camera,
      priority: RenderSpacePriority.low,
      entries: [new TestDrawable('low', order)],
    })
    const high = new RenderSpace({
      identifier: 'high',
      camera,
      priority: RenderSpacePriority.high,
      entries: [new TestDrawable('high', order)],
    })
    const renderer = new RendererModule({ backend, spaces: [low, high], clearColor: Color.black })
    const game = new TestGame([renderer])

    game.start()
    renderer.render(0.016)

    expect(order).toEqual(['low', 'high'])
    expect(backend.events).toEqual(['begin', 'end'])
    expect(backend.rendered).toHaveLength(3)
    expect(backend.rendered[0]).toEqual([new ClearCommand(Color.black)])
    expect(backend.rendered[1]).toEqual([])
    expect(backend.rendered[2]).toEqual([])
    expect(backend.contexts[1]?.viewport.size).toEqual(new Vector2(100, 50))

    game.stop()
    game.destroy()
    expect(backend.destroyed).toBe(true)
    expect(low.destroyed).toBe(true)
    expect(high.destroyed).toBe(true)
  })

  it('clears each target once and draws spaces into the target viewport', () => {
    const backend = new TestBackend()
    const target = new RenderTarget(new Vector2(320, 180))
    const camera = new Camera2D()
    const first = new RenderSpace({
      identifier: 'first',
      camera,
      target,
      entries: [new TestDrawable('first', [])],
    })
    const second = new RenderSpace({ identifier: 'second', camera, target })
    const renderer = new RendererModule({ backend, spaces: [first, second] })
    const game = new TestGame([renderer])

    game.start()
    renderer.render(0)

    expect(backend.rendered).toHaveLength(4)
    expect(backend.targets).toEqual([undefined, target, target, target])
    expect(backend.contexts[2]?.viewport.size).toEqual(new Vector2(320, 180))
    expect(backend.contexts[3]?.viewport.size).toEqual(new Vector2(320, 180))

    game.stop()
    game.destroy()
    target.destroy()
  })

  it('refuses to draw before the module is running', () => {
    const renderer = new RendererModule({ backend: new TestBackend() })

    expect(() => {
      renderer.render(0)
    }).toThrow('must be running')
  })

  it('registers and removes spaces', () => {
    const renderer = new RendererModule({ backend: new TestBackend() })
    const space = new RenderSpace({ identifier: 'space', camera: new Camera2D() })

    renderer.add(space)
    expect(renderer.spaces.get('space')).toBe(space)
    expect(renderer.remove('space')).toBe(space)
    expect(renderer.remove('space')).toBeUndefined()

    renderer.destroy()
  })

  it('composes spaces once across game restarts', () => {
    const backend = new TestBackend()
    class TestRendererModule extends RendererModule {
      public configureCount: number = 0

      protected override *compose(): Generator<RenderSpace> {
        yield new RenderSpace({ identifier: 'composed', camera: new Camera2D() })
      }

      protected override configure(): void {
        this.configureCount++
      }
    }

    const renderer = new TestRendererModule({ backend })
    const game = new TestGame([renderer])
    game.start()
    expect(renderer.spaces.has('composed')).toBe(true)
    expect(renderer.configureCount).toBe(1)
    game.stop()
    game.start()
    expect(renderer.configureCount).toBe(1)
    game.stop()
    game.destroy()
  })

  it('draws composed meshes through the drawable contract', () => {
    const backend = new TestBackend()
    const mesh = createMesh()
    const drawable = new (class extends TestDrawable {
      public override draw(): DrawData {
        return new DrawData([
          new Draw2DCommand({
            mesh,
            material: createMaterial(),
            transform: new Camera2D().localTransform,
          }),
        ])
      }
    })('mesh', [])
    const space = new RenderSpace({
      identifier: 'space',
      camera: new Camera2D(),
      entries: [drawable],
    })
    const renderer = new RendererModule({ backend, spaces: [space] })
    const game = new TestGame([renderer])

    game.start()
    renderer.render(0)
    expect(backend.rendered[1]?.[0]).toBeInstanceOf(Draw2DCommand)

    game.stop()
    game.destroy()
  })

  it('executes additional passes in priority order and owns them', () => {
    const backend = new TestBackend()
    const before = new TestPass('before', RenderPassPriority.low)
    const after = new TestPass('after', RenderPassPriority.high)
    const space = new RenderSpace({ identifier: 'space', camera: new Camera2D() })
    const renderer = new RendererModule({ backend, spaces: [space], passes: [after, before] })
    const game = new TestGame([renderer])

    expect(renderer.passes.size).toBe(4)
    expect(renderer.passes.get('after')).toBe(after)

    game.start()
    renderer.render(0.25)

    expect(before.contexts[0]?.deltaTime).toBe(0.25)
    expect(before.contexts[0]?.backend).toBe(backend)
    expect(before.contexts[0]?.spaces).toEqual([space])
    expect(before.commandCounts).toEqual([1])
    expect(after.commandCounts).toEqual([2])

    game.stop()
    game.destroy()
    expect(before.destroyed).toBe(true)
    expect(after.destroyed).toBe(true)
  })

  it('registers and removes passes', () => {
    const renderer = new RendererModule({ backend: new TestBackend() })
    const pass = new TestPass('custom', RenderPassPriority.low)

    renderer.addPass(pass)
    expect(renderer.passes.get('custom')).toBe(pass)
    expect(renderer.removePass('custom')).toBe(pass)
    expect(renderer.removePass('custom')).toBeUndefined()

    renderer.destroy()
  })
})
