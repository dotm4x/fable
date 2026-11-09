import { type GraphicMaterial, ScenesModule } from '@dotm4x/fable'

import { MyInputModule } from '../input/module.js'

import { MainScene } from './main.js'

export class MyScenesModule extends ScenesModule {
  public main: MainScene

  public constructor(material: GraphicMaterial) {
    const main = new MainScene(material)
    super({ initial: main, dependencies: [{ type: MyInputModule }] })
    this.main = main
  }
}
