import { Game, Module } from '@dotm4x/fable'

class WorldModule extends Module {
  public constructor() {
    super('world')
  }
}

class GreetingModule extends Module {
  public constructor() {
    super('greeting', [WorldModule])
  }

  protected override onStart(): void {
    const world = this.require(WorldModule)
    console.warn(`Hello from ${world.identifier}!`)
  }
}

class ExampleGame extends Game {
  protected override *compose(): Generator<Module> {
    yield new GreetingModule()
    yield new WorldModule()
  }
}

const game = new ExampleGame()
game.start()
game.stop()
game.destroy()
