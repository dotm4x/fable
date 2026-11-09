import { SceneManager } from '@dotm4x/fable'

import { MainScene } from './scenes/main.js'

export class MySceneManager extends SceneManager {
  public main: MainScene

  public constructor() {
    super({ initial: new MainScene() })
    this.main = new MainScene()
  }
}
