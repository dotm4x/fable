import { describe, expect, it, vi } from 'vitest'

import { Game, GameState, Module, ModuleState, type ModuleType } from '../../source/index.js'

class TestModule extends Module {
  public startHook: () => void = vi.fn()
  public stopHook: () => void = vi.fn()
  public destroyHook: () => void = vi.fn()

  public dependency<TModule extends Module>(type: ModuleType<TModule>): TModule {
    return this.require(type)
  }

  protected override onStart(): void {
    this.startHook()
  }

  protected override onStop(): void {
    this.stopHook()
  }

  protected override onDestroy(): void {
    this.destroyHook()
    super.onDestroy()
  }
}

class DependencyModule extends TestModule {}
class ConsumerModule extends TestModule {}
class MissingModule extends TestModule {}

class TestGame extends Game {
  public composed: Module[] = []
  public configureHook: () => void = vi.fn()
  public startHook: () => void = vi.fn()
  public stopHook: () => void = vi.fn()

  protected override *compose(): Generator<Module, void, unknown> {
    yield* this.composed
  }

  protected override configure(): void {
    this.configureHook()
  }

  protected override onStart(): void {
    this.startHook()
  }

  protected override onStop(): void {
    this.stopHook()
  }
}

describe('Game', () => {
  it('rejects reentrant lifecycle transitions from state notifications', () => {
    const game = new TestGame()
    const stopped = vi.fn()
    const started = vi.fn()
    game.stopHook = stopped
    game.startHook = started
    game.state.connect(({ value }) => {
      if (value === GameState.running) {
        expect(() => {
          game.stop()
        }).toThrow('cannot stop')
      }

      if (value === GameState.idle) {
        expect(() => {
          game.start()
        }).toThrow('cannot start')
        expect(() => {
          game.destroy()
        }).toThrow('lifecycle transition')
      }
    })

    game.start()
    expect(game.state.value).toBe(GameState.running)
    expect(started).toHaveBeenCalledOnce()
    game.stop()
    expect(game.state.value).toBe(GameState.idle)
    expect(stopped).toHaveBeenCalledOnce()
    game.destroy()
  })

  it('preserves the error when a module is destroyed during startup', () => {
    const first = new TestModule({ identifier: 'first' })
    const second = new TestModule({ identifier: 'second' })
    first.startHook = () => {
      second.destroy()
    }

    const game = new TestGame([first, second])

    expect(() => {
      game.start()
    }).toThrow("Module 'second' has already been destroyed.")
    expect(first.state.value).toBe(ModuleState.idle)
    expect(game.state.value).toBe(GameState.idle)
    game.destroy()
  })

  it('composes once, injects declared dependencies, and starts and stops in dependency order', () => {
    const calls: string[] = []
    const dependency = new DependencyModule({ identifier: 'dependency' })
    const consumer = new ConsumerModule({
      identifier: 'consumer',
      dependencies: [{ type: DependencyModule }],
    })
    dependency.startHook = () => calls.push('dependency start')
    consumer.startHook = () => {
      expect(consumer.dependency(DependencyModule)).toBe(dependency)
      calls.push('consumer start')
    }

    dependency.stopHook = () => calls.push('dependency stop')
    consumer.stopHook = () => calls.push('consumer stop')
    const game = new TestGame([consumer])
    game.composed.push(dependency)
    game.configureHook = vi.fn(() => {
      expect(game.modules.get('dependency')).toBe(dependency)
    })

    game.start()
    expect(game.state.value).toBe(GameState.running)
    expect(consumer.state.value).toBe(ModuleState.running)
    game.stop()
    game.start()
    game.stop()

    expect(game.configureHook).toHaveBeenCalledOnce()
    expect(calls).toEqual([
      'dependency start',
      'consumer start',
      'consumer stop',
      'dependency stop',
      'dependency start',
      'consumer start',
      'consumer stop',
      'dependency stop',
    ])
  })

  it('rejects duplicate, missing, and circular dependencies', () => {
    expect(
      () =>
        new TestGame([new TestModule({ identifier: 'a' }), new TestModule({ identifier: 'a' })]),
    ).toThrow('Duplicate')
    const missing = new TestGame([
      new ConsumerModule({ identifier: 'a', dependencies: [{ type: MissingModule }] }),
    ])
    expect(() => {
      missing.start()
    }).toThrow('missing dependency')
    expect(() => {
      missing.start()
    }).toThrow('missing dependency')
    const cyclic = new TestGame([
      new ConsumerModule({ identifier: 'a', dependencies: [{ type: DependencyModule }] }),
      new DependencyModule({ identifier: 'b', dependencies: [{ type: ConsumerModule }] }),
    ])
    expect(() => {
      cyclic.start()
    }).toThrow('a -> b -> a')
  })

  it('resolves subclasses and rejects ambiguous matches before starting modules', () => {
    class DerivedDependency extends DependencyModule {}
    const dependency = new DerivedDependency({ identifier: 'dependency' })
    const consumer = new ConsumerModule({
      identifier: 'consumer',
      dependencies: [{ type: DependencyModule }],
    })
    const game = new TestGame([consumer, dependency])
    game.start()
    expect(consumer.dependency(DependencyModule)).toBe(dependency)
    game.stop()

    const first = new DependencyModule({ identifier: 'first' })
    const second = new DerivedDependency({ identifier: 'second' })
    const ambiguousConsumer = new ConsumerModule({
      identifier: 'consumer',
      dependencies: [{ type: DependencyModule }],
    })
    const ambiguous = new TestGame([ambiguousConsumer, first, second])
    expect(() => {
      ambiguous.start()
    }).toThrow("ambiguous dependency 'DependencyModule': first, second")
    expect(first.state.value).toBe(ModuleState.idle)
    expect(second.state.value).toBe(ModuleState.idle)
    expect(ambiguousConsumer.state.value).toBe(ModuleState.idle)
  })

  it('rejects a dependency resolved to the module itself', () => {
    const game = new TestGame([
      new ConsumerModule({ identifier: 'self', dependencies: [{ type: ConsumerModule }] }),
    ])
    expect(() => {
      game.start()
    }).toThrow('self -> self')
  })

  it('cleans up a partially started module and rolls back earlier modules', () => {
    const dependency = new DependencyModule({ identifier: 'dependency' })
    const consumer = new ConsumerModule({
      identifier: 'consumer',
      dependencies: [{ type: DependencyModule }],
    })
    const cleanup = vi.fn()
    const rollback = vi.fn()
    dependency.stopHook = rollback
    consumer.startHook = () => {
      throw new Error('startup failed')
    }

    consumer.stopHook = cleanup
    const game = new TestGame([consumer, dependency])

    expect(() => {
      game.start()
    }).toThrow('startup failed')
    expect(cleanup).toHaveBeenCalledOnce()
    expect(rollback).toHaveBeenCalledOnce()
    expect(game.state.value).toBe(GameState.idle)
  })

  it('rolls back after a game startup hook fails', () => {
    const module = new TestModule({ identifier: 'module' })
    const stopped = vi.fn()
    module.stopHook = stopped
    const game = new TestGame([module])
    game.startHook = () => {
      throw new Error('game startup failed')
    }

    expect(() => {
      game.start()
    }).toThrow('game startup failed')
    expect(stopped).toHaveBeenCalledOnce()
    expect(game.state.value).toBe(GameState.idle)
    expect(module.state.value).toBe(ModuleState.idle)
  })

  it('recovers after a running state notification fails', () => {
    const module = new TestModule({ identifier: 'module' })
    const stopped = vi.fn()
    module.stopHook = stopped
    module.state.connect(({ value }) => {
      if (value === ModuleState.running) {
        throw new Error('notification failed')
      }
    })
    const game = new TestGame([module])

    expect(() => {
      game.start()
    }).toThrow('notification failed')
    expect(stopped).toHaveBeenCalledOnce()
    expect(module.state.value).toBe(ModuleState.idle)
    expect(game.state.value).toBe(GameState.idle)
  })

  it('retries failed shutdown without stopping dependencies prematurely', () => {
    const dependency = new DependencyModule({ identifier: 'dependency' })
    const consumer = new ConsumerModule({
      identifier: 'consumer',
      dependencies: [{ type: DependencyModule }],
    })
    consumer.stopHook = vi.fn().mockImplementationOnce(() => {
      throw new Error('stop failed')
    })
    const game = new TestGame([dependency, consumer])
    game.start()
    expect(() => {
      game.stop()
    }).toThrow('stop failed')
    expect(game.state.value).toBe(GameState.failed)
    expect(dependency.state.value).toBe(ModuleState.running)
    expect(consumer.state.value).toBe(ModuleState.running)
    game.stop()
    expect(game.state.value).toBe(GameState.idle)
  })

  it('does not repeat configuration after a failure', () => {
    const game = new TestGame()
    game.configureHook = vi.fn(() => {
      throw new Error('configuration failed')
    })
    expect(() => {
      game.start()
    }).toThrow('configuration failed')
    expect(() => {
      game.start()
    }).toThrow('preparation')
    expect(game.configureHook).toHaveBeenCalledOnce()
  })

  it('cleans up a duplicate composed module without destroying the registered module', () => {
    const original = new TestModule({ identifier: 'module' })
    const duplicate = new TestModule({ identifier: 'module' })
    const game = new TestGame([original])
    game.composed.push(duplicate)
    expect(() => {
      game.start()
    }).toThrow('Duplicate')
    expect(duplicate.destroyed).toBe(true)
    expect(original.destroyed).toBe(false)
    game.destroy()
    expect(original.destroyed).toBe(true)
  })

  it('keeps dependencies running after failed cleanup and retries shutdown', () => {
    const dependency = new DependencyModule({ identifier: 'dependency' })
    const consumer = new ConsumerModule({
      identifier: 'consumer',
      dependencies: [{ type: DependencyModule }],
    })
    consumer.startHook = () => {
      throw new Error('startup failed')
    }

    consumer.stopHook = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('cleanup failed')
      })
      .mockImplementationOnce(() => {
        throw new Error('rollback failed')
      })
    const game = new TestGame([consumer, dependency])

    expect(() => {
      game.start()
    }).toThrow(AggregateError)
    expect(game.state.value).toBe(GameState.failed)
    expect(dependency.state.value).toBe(ModuleState.running)
    expect(consumer.state.value).toBe(ModuleState.running)
    game.stop()
    expect(game.state.value).toBe(GameState.idle)
    expect(dependency.state.value).toBe(ModuleState.idle)
  })

  it('destroys owned modules in reverse order and retries failed destruction', () => {
    const dependency = new DependencyModule({ identifier: 'dependency' })
    const consumer = new ConsumerModule({
      identifier: 'consumer',
      dependencies: [{ type: DependencyModule }],
    })
    const consumerDestroy = vi.fn()
    const dependencyDestroy = vi.fn().mockImplementationOnce(() => {
      throw new Error('destroy failed')
    })
    consumer.destroyHook = consumerDestroy
    dependency.destroyHook = dependencyDestroy
    const game = new TestGame([consumer, dependency])
    game.start()
    expect(() => {
      game.destroy()
    }).toThrow('cannot be destroyed')
    game.stop()

    expect(() => {
      game.destroy()
    }).toThrow('destroy failed')
    expect(consumer.destroyed).toBe(true)
    expect(() => {
      game.start()
    }).toThrow('cannot start')
    game.destroy()
    expect(dependency.destroyed).toBe(true)
    expect(consumerDestroy).toHaveBeenCalledOnce()
    expect(dependencyDestroy).toHaveBeenCalledTimes(2)
  })

  it('can retry destruction after a derived module fails after base cleanup', () => {
    class LateFailingModule extends Module {
      private _failed: boolean = false

      protected override onDestroy(): void {
        super.onDestroy()
        if (!this._failed) {
          this._failed = true
          throw new Error('late failure')
        }
      }
    }

    const module = new LateFailingModule({ identifier: 'module' })
    const game = new TestGame([module])
    expect(() => {
      game.destroy()
    }).toThrow('late failure')
    expect(module.destroyed).toBe(false)
    game.destroy()
    expect(module.destroyed).toBe(true)
    expect(game.destroyed).toBe(true)
  })

  it('can retry game destruction after a derived hook fails after base cleanup', () => {
    class LateFailingGame extends Game {
      private _failed: boolean = false

      protected override onDestroy(): void {
        super.onDestroy()
        if (!this._failed) {
          this._failed = true
          throw new Error('late failure')
        }
      }
    }

    const game = new LateFailingGame()
    expect(() => {
      game.destroy()
    }).toThrow('late failure')
    game.destroy()
    expect(game.destroyed).toBe(true)
  })
})
