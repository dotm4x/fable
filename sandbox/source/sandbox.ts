import { Game, type Module, type Updatable } from '@dotm4x/fable'

import { MyInputManager } from './input-manager/module.js'
import { MySceneManager } from './scene-manager/module.js'
import { MyScheduler } from './scheduler/module.js'

export class Sandbox extends Game implements Updatable {
  public scheduler: MyScheduler
  public scenes: MySceneManager
  public input: MyInputManager

  public constructor() {
    super()
    this.scheduler = new MyScheduler(this)
    this.scenes = new MySceneManager()
    this.input = new MyInputManager({ target: document.body })
  }

  protected override *compose(): Generator<Module> {
    yield this.scheduler
    yield this.scenes
    yield this.input
  }

  public update(): void {
    return
  }
}
