import { describe, expect, it } from 'vitest'

import {
  Camera2D,
  type Drawable,
  DrawData,
  Game,
  Node,
  Node2D,
  NodeRenderSpace,
  RenderContext,
  ScenesModule,
  Vector2,
  Viewport,
} from '../../../../source/index.js'

class TestGame extends Game {}

class DrawableNode extends Node2D implements Drawable {
  public readonly draws: string[]
  public readonly label: string

  public constructor(name: string, draws: string[]) {
    super({ name })
    this.label = name
    this.draws = draws
  }

  public draw(): DrawData {
    this.draws.push(this.label)

    return new DrawData([])
  }
}

function createContext(): RenderContext {
  return new RenderContext(
    0.016,
    new Camera2D(),
    new Viewport(new Vector2(0, 0), new Vector2(10, 10)),
  )
}

describe('NodeRenderSpace', () => {
  it('collects drawable nodes in hierarchy order and skips invisible subtrees', () => {
    const draws: string[] = []
    const visible = new DrawableNode('visible', draws)
    const hidden = new DrawableNode('hidden', draws)
    hidden.visible.value = false
    const child = new DrawableNode('child', draws)
    visible.add(child)
    const root = new Node({ name: 'root', children: [visible, hidden] })
    const scenes = new ScenesModule({ initial: root })
    const space = new NodeRenderSpace({ identifier: 'nodes', camera: new Camera2D(), scenes })
    const game = new TestGame([scenes])

    game.start()
    space.collect(createContext())

    expect(draws).toEqual(['visible', 'child'])

    game.stop()
    game.destroy()
    space.destroy()
  })

  it('skips nodes that are not loaded or not drawable', () => {
    const draws: string[] = []
    const root = new Node({ name: 'root', children: [new Node({ name: 'plain' })] })
    const scenes = new ScenesModule({ initial: root })
    const space = new NodeRenderSpace({ identifier: 'nodes', camera: new Camera2D(), scenes })
    const drawable = new DrawableNode('late', draws)
    root.add(drawable)

    space.collect(createContext())
    expect(draws).toEqual([])

    space.destroy()
    scenes.destroy()
  })
})
