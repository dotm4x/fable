import { describe, expect, expectTypeOf, it } from 'vitest'

import {
  Game,
  Module,
  type ModuleDependency,
  ModuleState,
  type ModuleType,
} from '../../source/index.js'

class TestModule extends Module {
  public dependency<TModule extends Module>(type: ModuleType<TModule>): TModule {
    return this.require(type)
  }

  public optionalDependency<TModule extends Module>(
    type: ModuleType<TModule>,
  ): TModule | undefined {
    return this.optional(type)
  }
}

class DependencyModule extends TestModule {
  public readonly example: string = 'dependency'
}
class OtherModule extends TestModule {}
class ConsumerModule extends TestModule {}
class TestGame extends Game {}

describe('Module', () => {
  it('exposes an immutable copy of dependency classes', () => {
    const dependencies: ModuleDependency[] = [{ type: DependencyModule }]
    const module = new TestModule({ identifier: 'b', dependencies })
    dependencies.push({ type: OtherModule })

    expect(module.identifier).toBe('b')
    expect(module.dependencies).toEqual([{ type: DependencyModule }])
    expect(Object.isFrozen(module.dependencies)).toBe(true)
    expect(module.state.value).toBe(ModuleState.idle)
  })

  it('resolves optional dependencies when present and returns undefined when absent', () => {
    const consumer = new ConsumerModule({
      identifier: 'consumer',
      dependencies: [{ type: DependencyModule, optional: true }],
    })
    expect(() => consumer.optionalDependency(DependencyModule)).toThrow('not been injected')
    const game = new TestGame([consumer])
    game.start()
    expect(consumer.optionalDependency(DependencyModule)).toBeUndefined()
    expect(() => consumer.dependency(DependencyModule)).toThrow('uninjected')
    expect(() => consumer.optionalDependency(OtherModule)).toThrow('not declared')
    game.stop()
    game.destroy()

    const dependency = new DependencyModule({ identifier: 'dependency' })
    const otherConsumer = new ConsumerModule({
      identifier: 'other',
      dependencies: [{ type: DependencyModule, optional: true }],
    })
    const otherGame = new TestGame([otherConsumer, dependency])
    otherGame.start()
    expect(otherConsumer.optionalDependency(DependencyModule)).toBe(dependency)
    otherGame.stop()
    otherGame.destroy()
  })

  it('rejects duplicate declarations and ambiguous optional dependencies', () => {
    expect(
      () =>
        new ConsumerModule({
          identifier: 'duplicate',
          dependencies: [{ type: DependencyModule }, { type: DependencyModule, optional: true }],
        }),
    ).toThrow('more than once')
    const consumer = new ConsumerModule({
      identifier: 'consumer',
      dependencies: [{ type: DependencyModule, optional: true }],
    })

    const game = new TestGame([
      consumer,
      new DependencyModule({ identifier: 'a' }),
      new DependencyModule({ identifier: 'b' }),
    ])
    expect(() => {
      game.start()
    }).toThrow('ambiguous')
    game.destroy()
  })

  it('starts optional dependencies first and rejects optional dependency cycles', () => {
    const calls: string[] = []
    class Dependency extends TestModule {
      protected override onStart(): void {
        calls.push('dependency')
      }
    }
    class Consumer extends TestModule {
      protected override onStart(): void {
        calls.push('consumer')
      }
    }
    const dependency = new Dependency({ identifier: 'dependency' })
    const consumer = new Consumer({
      identifier: 'consumer',
      dependencies: [{ type: Dependency, optional: true }],
    })
    const game = new TestGame([consumer, dependency])
    game.start()
    expect(calls).toEqual(['dependency', 'consumer'])
    game.stop()
    game.destroy()
    const cyclic = new TestGame([
      new Consumer({ identifier: 'a', dependencies: [{ type: Dependency, optional: true }] }),
      new Dependency({ identifier: 'b', dependencies: [{ type: Consumer, optional: true }] }),
    ])
    expect(() => {
      cyclic.start()
    }).toThrow('Circular')
    cyclic.destroy()
  })

  it('only exposes declared dependencies after injection', () => {
    const dependency = new DependencyModule({ identifier: 'a' })
    const other = new OtherModule({ identifier: 'other' })
    const consumer = new ConsumerModule({
      identifier: 'b',
      dependencies: [{ type: DependencyModule }],
    })
    expect(() => consumer.dependency(DependencyModule)).toThrow('not been injected')
    const game = new TestGame([dependency, other, consumer])
    game.start()

    expectTypeOf(consumer.dependency(DependencyModule)).toEqualTypeOf<DependencyModule>()
    expect(consumer.dependency(DependencyModule)).toBe(dependency)
    expect(() => consumer.dependency(OtherModule)).toThrow('uninjected')
    game.stop()
    game.destroy()
    expect(() => consumer.dependency(DependencyModule)).toThrow('destroyed')
  })
})
