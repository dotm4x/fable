import { Game, type Module, type Updatable } from '@dotm4x/fable'

import { MyInputModule } from './input/module.js'
import { MyScenesModule } from './scenes/module.js'
import { MyTimeModule } from './time/module.js'

export class Sandbox extends Game implements Updatable {
  public time: MyTimeModule
  public scenes: MyScenesModule
  public input: MyInputModule

  public constructor() {
    super()
    this.time = new MyTimeModule(this)
    this.scenes = new MyScenesModule()
    this.input = new MyInputModule({ target: document.body })
  }

  protected override *compose(): Generator<Module> {
    yield this.time
    yield this.scenes
    yield this.input
  }

  public update(): void {
    return
  }
}
