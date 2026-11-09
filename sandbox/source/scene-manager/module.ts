import { SceneManager } from '@dotm4x/fable'

import { MyInputManager } from '../input-manager/module.js'

import { MainScene } from './scenes/main.js'

export class MySceneManager extends SceneManager {
  public main: MainScene

  public constructor() {
    const main = new MainScene()
    super({ initial: main, dependencies: [{ type: MyInputManager }] })
    this.main = main
  }
}
