import { Camera2D, type GraphicMaterial, ScenesModule } from '@dotm4x/fable'

import { MyInputModule } from '../input/module.js'

import { MainScene } from './main.js'
import { SnakeScene } from './snake/scene.js'

export class MyScenesModule extends ScenesModule {
  public readonly camera: Camera2D
  public readonly main: MainScene
  public readonly snake: SnakeScene

  public constructor(material: GraphicMaterial, snakeMaterial: GraphicMaterial) {
    const camera = new Camera2D({ name: 'camera' })
    const main = new MainScene(material, camera)
    const snake = new SnakeScene(snakeMaterial, camera)
    const requested = new URLSearchParams(globalThis.location.search).get('scene')
    super({
      initial: requested === 'snake' ? snake : main,
      dependencies: [{ type: MyInputModule }],
    })
    this.camera = camera
    this.main = main
    this.snake = snake
  }

  protected override onDestroy(): void {
    super.onDestroy()
    if (!this.camera.destroyed) this.camera.destroy()
  }
}
