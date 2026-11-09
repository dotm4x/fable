import { describe, expect, it } from 'vitest'

import { Game, LoggerModule, Module, Node, ScenesModule } from '../../../source/index.js'

class TestGame extends Game {}

describe('ScenesModule', () => {
  it('loads the initial scene and switches, preserving stable scene keys', () => {
    const first = new Node({ name: 'first' })
    const second = new Node({ name: 'second' })
    const manager = new ScenesModule({ initial: first, scenes: [second] })
    second.name.value = 'renamed'
    const game = new TestGame([manager])
    game.start()
    expect(first.loaded).toBe(true)
    manager.switch('second')
    expect(first.loaded).toBe(false)
    expect(second.loaded).toBe(true)
    expect(manager.activeScene.value).toBe(second)
    expect(() => {
      manager.remove('second')
    }).toThrow('active')
    game.stop()
    game.destroy()
    expect(first.destroyed).toBe(true)
    expect(second.destroyed).toBe(true)
  })

  it('accepts absent optional logger and exposes explicitly declared dependencies to nodes', () => {
    class Service extends Module {
      public constructor() {
        super({ identifier: 'service' })
      }
    }
    class Consumer extends Node {
      public service: Service | undefined
      public logger: LoggerModule | undefined
      protected override configure(): void {
        this.service = this.require(Service)
        this.logger = this.optional(LoggerModule)
      }
    }
    const scene = new Consumer({ name: 'scene' })
    const service = new Service()
    const manager = new ScenesModule({ initial: scene, dependencies: [{ type: Service }] })
    const game = new TestGame([manager, service])
    game.start()
    expect(scene.service).toBe(service)
    expect(scene.logger).toBeUndefined()
    expect(manager.dependencies).toContainEqual({ type: LoggerModule, optional: true })
    game.stop()
    game.destroy()
  })

  it('exposes an available optional logger to nodes', () => {
    class Consumer extends Node {
      public logger: LoggerModule | undefined
      protected override configure(): void {
        this.logger = this.optional(LoggerModule)
      }
    }
    const scene = new Consumer()
    const logger = new LoggerModule()
    const game = new TestGame([new ScenesModule({ initial: scene }), logger])
    game.start()
    expect(scene.logger).toBe(logger)
    game.stop()
    game.destroy()
  })

  it('destroys unowned scenes rejected during composition', () => {
    const duplicate = new Node({ name: 'initial' })
    class TestManager extends ScenesModule {
      protected override *compose(): Generator<Node> {
        yield duplicate
      }
    }
    const initial = new Node({ name: 'initial' })
    const game = new TestGame([new TestManager({ initial })])
    expect(() => {
      game.start()
    }).toThrow('Duplicate')
    expect(duplicate.destroyed).toBe(true)
    expect(initial.destroyed).toBe(false)
    game.destroy()
  })

  it('rejects duplicate names and ownership and releases removed scenes', () => {
    const first = new Node({ name: 'first' })
    const other = new Node({ name: 'other' })
    const manager = new ScenesModule({ initial: first, scenes: [other] })
    expect(() => new ScenesModule({ initial: first })).toThrow('unowned')
    expect(() => {
      manager.add(new Node({ name: 'other' }))
    }).toThrow('Duplicate')
    expect(manager.remove('other')).toBe(other)
    expect(other.destroyed).toBe(false)
    other.destroy()
    manager.destroy()
  })

  it('restores the previous scene when a switch fails', () => {
    class Broken extends Node {
      protected override onLoad(): void {
        throw new Error('scene failed')
      }
    }
    const first = new Node({ name: 'first' })
    const second = new Broken({ name: 'second' })
    const manager = new ScenesModule({ initial: first, scenes: [second] })
    const game = new TestGame([manager])
    game.start()
    expect(() => {
      manager.switch('second')
    }).toThrow('scene failed')
    expect(manager.activeScene.value).toBe(first)
    expect(first.loaded).toBe(true)
    expect(second.loaded).toBe(false)
    game.stop()
    game.destroy()
  })

  it('selects scenes while idle and rejects reentrant switches', () => {
    const first = new Node({ name: 'first' })
    const second = new Node({ name: 'second' })
    const manager = new ScenesModule({ initial: first, scenes: [second] })
    manager.switch('second')
    expect(second.loaded).toBe(false)
    const connection = manager.activeScene.connect(() => {
      manager.switch('second')
    })
    expect(() => {
      manager.switch('first')
    }).toThrow(AggregateError)
    expect(manager.activeScene.value).toBe(second)
    connection.disconnect()
    manager.destroy()
  })

  it('cleans newly loaded persistent nodes when switch notification fails', () => {
    const first = new Node({ name: 'first' })
    const persistent = new Node({ persistent: true })
    const second = new Node({ name: 'second', children: [persistent] })
    const manager = new ScenesModule({ initial: first, scenes: [second] })
    const game = new TestGame([manager])
    game.start()
    const connection = manager.activeScene.connect(({ value }) => {
      if (value === second) throw new Error('notification failed')
    })
    expect(() => {
      manager.switch('second')
    }).toThrow('notification failed')
    expect(first.loaded).toBe(true)
    expect(second.loaded).toBe(false)
    expect(persistent.loaded).toBe(false)
    connection.disconnect()
    game.stop()
    game.destroy()
  })
})
