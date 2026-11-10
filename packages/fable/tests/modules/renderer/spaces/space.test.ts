import { describe, expect, it } from 'vitest'

import {
  Camera2D,
  Color,
  Draw2DCommand,
  type Drawable,
  DrawData,
  GraphicMaterial,
  GraphicMesh2D,
  GraphicVertex2D,
  Matrix3x2,
  RenderContext,
  RenderSortMode,
  RenderSpace,
  RenderSpacePriority,
  RenderTarget,
  Shader,
  ShaderLanguage,
  ShaderStage,
  Vector2,
  Viewport,
} from '../../../../source/index.js'

class TestDrawable implements Drawable {
  public readonly calls: string[]
  public readonly name: string

  public constructor(name: string, calls: string[]) {
    this.name = name
    this.calls = calls
  }

  public draw(): DrawData {
    this.calls.push(this.name)

    return new DrawData([])
  }
}

describe('RenderSpace', () => {
  it('collects entries in registration order', () => {
    const calls: string[] = []
    const space = new RenderSpace({
      identifier: 'space',
      camera: new Camera2D(),
      entries: [new TestDrawable('first', calls), new TestDrawable('second', calls)],
    })
    const context = new RenderContext(
      0.016,
      new Camera2D(),
      new Viewport(new Vector2(0, 0), new Vector2(10, 10)),
    )

    expect(space.collect(context)).toEqual([])
    expect(calls).toEqual(['first', 'second'])
    space.destroy()
  })

  function createMaterial(): GraphicMaterial {
    return new GraphicMaterial({
      vertexShader: new Shader({
        code: 'vertex',
        language: ShaderLanguage.glsl,
        stage: ShaderStage.vertex,
      }),
      fragmentShader: new Shader({
        code: 'fragment',
        language: ShaderLanguage.glsl,
        stage: ShaderStage.fragment,
      }),
    })
  }

  function commandAt(x: number, y: number, order: number = 0, depth: number = 0): Draw2DCommand {
    const mesh = new GraphicMesh2D([
      new GraphicVertex2D(new Vector2(x - 10, y - 10), new Vector2(0, 0), Color.white),
      new GraphicVertex2D(new Vector2(x + 10, y - 10), new Vector2(1, 0), Color.white),
      new GraphicVertex2D(new Vector2(x, y + 10), new Vector2(0, 1), Color.white),
    ])

    return new Draw2DCommand({
      mesh,
      material: createMaterial(),
      transform: Matrix3x2.identity,
      order,
      depth,
    })
  }

  class CommandDrawable implements Drawable {
    public readonly commands: Draw2DCommand[]

    public constructor(commands: Draw2DCommand[]) {
      this.commands = commands
    }

    public draw(): DrawData {
      return new DrawData(this.commands)
    }
  }

  it('sorts commands by order and skips commands outside the camera view', () => {
    const inside = new CommandDrawable([commandAt(0, 0, 2)])
    const outside = new CommandDrawable([commandAt(5000, 5000, 1)])
    const first = new CommandDrawable([commandAt(10, 10, -1)])
    const space = new RenderSpace({
      identifier: 'space',
      camera: new Camera2D(),
      entries: [inside, outside, first],
    })
    const context = new RenderContext(
      0,
      new Camera2D(),
      new Viewport(new Vector2(0, 0), new Vector2(640, 360)),
    )

    const commands = space.collect(context)

    expect(commands).toHaveLength(2)
    expect((commands[0] as Draw2DCommand).order).toBe(-1)
    expect((commands[1] as Draw2DCommand).order).toBe(2)
    space.destroy()
  })

  it('groups commands that share a material while preserving order', () => {
    const first = createMaterial()
    const second = createMaterial()
    const mesh = new GraphicMesh2D([
      new GraphicVertex2D(new Vector2(0, 0), new Vector2(0, 0), Color.white),
      new GraphicVertex2D(new Vector2(1, 0), new Vector2(1, 0), Color.white),
      new GraphicVertex2D(new Vector2(0, 1), new Vector2(0, 1), Color.white),
    ])
    const firstCommand = new Draw2DCommand({
      mesh,
      material: first,
      transform: Matrix3x2.identity,
    })
    const secondCommand = new Draw2DCommand({
      mesh,
      material: second,
      transform: Matrix3x2.identity,
    })
    const thirdCommand = new Draw2DCommand({
      mesh,
      material: first,
      transform: Matrix3x2.identity,
    })
    const space = new RenderSpace({
      identifier: 'space',
      camera: new Camera2D(),
      entries: [
        new CommandDrawable([firstCommand]),
        new CommandDrawable([secondCommand]),
        new CommandDrawable([thirdCommand]),
      ],
    })
    const context = new RenderContext(
      0,
      new Camera2D(),
      new Viewport(new Vector2(0, 0), new Vector2(640, 360)),
    )

    const collected = space.collect(context) as Draw2DCommand[]

    expect(collected[0]?.material).toBe(first)
    expect(collected[1]?.material).toBe(first)
    expect(collected[2]?.material).toBe(second)
    space.destroy()
  })

  it('keeps culled commands when culling is disabled', () => {
    const outside = new CommandDrawable([commandAt(5000, 5000)])
    const space = new RenderSpace({
      identifier: 'space',
      camera: new Camera2D(),
      cull: false,
      entries: [outside],
    })
    const context = new RenderContext(
      0,
      new Camera2D(),
      new Viewport(new Vector2(0, 0), new Vector2(640, 360)),
    )

    expect(space.collect(context)).toHaveLength(1)
    space.destroy()
  })

  it('defaults to normal priority and a live camera store', () => {
    const camera = new Camera2D()
    const space = new RenderSpace({ identifier: 'space', camera })

    expect(space.priority).toBe(RenderSpacePriority.normal)
    expect(space.camera.value).toBe(camera)
    space.destroy()
  })

  it('exposes a target store that is destroyed with the space', () => {
    const target = new RenderTarget(new Vector2(10, 10))
    const space = new RenderSpace({ identifier: 'space', camera: new Camera2D(), target })

    expect(space.target.value).toBe(target)

    space.destroy()
    expect(space.target.destroyed).toBe(true)
    target.destroy()
  })

  it('rejects empty identifiers', () => {
    expect(() => new RenderSpace({ identifier: ' ', camera: new Camera2D() })).toThrow(
      'identifier must not be empty',
    )
  })

  it('composes entries once and clears them on destruction', () => {
    const calls: string[] = []
    class TestSpace extends RenderSpace {
      public configureCount: number = 0

      protected override *compose(): Generator<Drawable> {
        yield new TestDrawable('composed', calls)
      }

      protected override configure(): void {
        this.configureCount++
      }
    }
    const space = new TestSpace({ identifier: 'space', camera: new Camera2D() })
    const context = new RenderContext(
      0,
      new Camera2D(),
      new Viewport(new Vector2(0, 0), new Vector2(1, 1)),
    )

    space.collect(context)
    space.collect(context)

    expect(space.configureCount).toBe(1)
    expect(calls).toEqual(['composed', 'composed'])
    expect(space.entries.size).toBe(1)

    space.destroy()
    expect(space.entries.size).toBe(0)
  })

  it('draws farthest commands first when sorting by depth', () => {
    const near = new CommandDrawable([commandAt(0, 0, 0, 1)])
    const far = new CommandDrawable([commandAt(0, 0, 0, 3)])
    const middle = new CommandDrawable([commandAt(0, 0, 0, 2)])
    const space = new RenderSpace({
      identifier: 'space',
      camera: new Camera2D(),
      sort: RenderSortMode.depth,
      entries: [near, far, middle],
    })
    const context = new RenderContext(
      0,
      new Camera2D(),
      new Viewport(new Vector2(0, 0), new Vector2(640, 360)),
    )

    const depths = (space.collect(context) as Draw2DCommand[]).map((command) => command.depth)

    expect(depths).toEqual([3, 2, 1])
    space.destroy()
  })
})
