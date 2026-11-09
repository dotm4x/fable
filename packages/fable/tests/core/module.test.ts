import { describe, expect, expectTypeOf, it } from 'vitest'

import { Game, Module, ModuleState, type ModuleType } from '../../source/index.js'

class TestModule extends Module {
  public dependency<TModule extends Module>(type: ModuleType<TModule>): TModule {
    return this.require(type)
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
    const dependencies: ModuleType[] = [DependencyModule]
    const module = new TestModule({ identifier: 'b', dependencies })
    dependencies.push(OtherModule)

    expect(module.identifier).toBe('b')
    expect(module.dependencies).toEqual([DependencyModule])
    expect(Object.isFrozen(module.dependencies)).toBe(true)
    expect(module.state.value).toBe(ModuleState.idle)
  })

  it('only exposes declared dependencies after injection', () => {
    const dependency = new DependencyModule({ identifier: 'a' })
    const other = new OtherModule({ identifier: 'other' })
    const consumer = new ConsumerModule({ identifier: 'b', dependencies: [DependencyModule] })
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
