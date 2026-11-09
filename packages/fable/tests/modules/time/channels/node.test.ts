import { describe, expect, it, vi } from 'vitest'

import {
  ChannelPriority,
  Game,
  Node,
  NodeChannel,
  ScenesModule,
  type Updatable,
  type UpdateContext,
} from '../../../../source/index.js'

class TestGame extends Game {}

describe('NodeChannel', () => {
  it('updates loaded updatable nodes in depth-first order and follows active scenes', () => {
    const calls: string[] = []
    class UpdatingNode extends Node implements Updatable {
      public update(context: UpdateContext): void {
        calls.push(`${this.name.value}:${String(context.deltaTime)}`)
      }
    }
    const leaf = new UpdatingNode({ name: 'leaf' })
    const container = new Node({ name: 'container', children: [leaf] })
    const root = new UpdatingNode({ name: 'root', children: [container] })
    const next = new UpdatingNode({ name: 'next' })
    const manager = new ScenesModule({ initial: root, scenes: [next] })
    const channel = new NodeChannel({ manager })
    expect(channel.identifier).toBe('nodes')
    const game = new TestGame([manager])
    game.start()
    channel.update(0.1)
    expect(calls).toEqual(['root:0.1', 'leaf:0.1'])
    manager.switch('next')
    channel.update(0.2)
    expect(calls).toEqual(['root:0.1', 'leaf:0.1', 'next:0.2'])
    channel.destroy()
    expect(manager.destroyed).toBe(false)
    expect(next.destroyed).toBe(false)
    game.stop()
    game.destroy()
  })

  it('visits loaded persistent descendants even if their parent is unloaded', () => {
    const update = vi.fn<(context: UpdateContext) => void>()
    class Persistent extends Node {
      public update(context: UpdateContext): void {
        update(context)
      }
    }
    const child = new Persistent({ persistent: true })
    const root = new Node({ children: [child] })
    const manager = new ScenesModule({ initial: root })
    const game = new TestGame([manager])
    game.start()
    game.stop()
    new NodeChannel({ manager }).update(0.1)
    expect(update).toHaveBeenCalledOnce()
    game.destroy()
  })

  it('uses the channel rate and updates explicit entries before nodes', () => {
    const calls: string[] = []
    class UpdatingNode extends Node {
      public update(): void {
        calls.push('node')
      }
    }
    const manager = new ScenesModule({ initial: new UpdatingNode() })
    const game = new TestGame([manager])
    game.start()
    const channel = new NodeChannel({
      manager,
      identifier: 'custom',
      priority: ChannelPriority.high,
      targetUpdateRate: 2,
      entries: [
        {
          update: () => {
            calls.push('entry')
          },
        },
      ],
    })
    channel.update(0.2)
    expect(calls).toEqual([])
    channel.update(0.3)
    expect(calls).toEqual(['entry', 'node'])
    expect(channel.identifier).toBe('custom')
    expect(channel.priority).toBe(ChannelPriority.high)
    game.stop()
    game.destroy()
  })

  it('handles child removal and destruction during traversal', () => {
    const update = vi.fn()
    const root = new Node()
    class Child extends Node {
      public update(): void {
        root.remove(this)
        this.destroy()
      }
    }
    class Grandchild extends Node {
      public update(): void {
        update()
      }
    }
    const child = new Child({ children: [new Grandchild()] })
    root.add(child)
    const manager = new ScenesModule({ initial: root })
    const game = new TestGame([manager])
    game.start()
    new NodeChannel({ manager }).update(0.1)
    expect(child.destroyed).toBe(true)
    expect(update).not.toHaveBeenCalled()
    game.stop()
    game.destroy()
  })

  it('propagates node errors and rejects use after channel or manager destruction', () => {
    class Broken extends Node {
      public update(): void {
        throw new Error('node failed')
      }
    }
    const manager = new ScenesModule({ initial: new Broken() })
    const game = new TestGame([manager])
    const channel = new NodeChannel({ manager })
    game.start()
    expect(() => {
      channel.update(0.1)
    }).toThrow('node failed')
    game.stop()
    game.destroy()
    expect(() => {
      channel.update(0.1)
    }).toThrow('destroyed')
    channel.destroy()
    expect(() => {
      channel.update(0.1)
    }).toThrow('destroyed')
  })
})
