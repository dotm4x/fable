import { Camera2D, type GraphicMaterial, type Node2D, ScenesModule } from '@dotm4x/fable'

import { MyInputModule } from '../input/module.js'

import { type BallsMode, BallsScene } from './bench/scene.js'
import { MainScene } from './main.js'
import { SnakeScene } from './snake/scene.js'

export class MyScenesModule extends ScenesModule {
  public readonly camera: Camera2D
  public readonly main: MainScene
  public readonly snake: SnakeScene
  public readonly balls: BallsScene

  public constructor(material: GraphicMaterial, snakeMaterial: GraphicMaterial) {
    const camera = new Camera2D({ name: 'camera' })
    const main = new MainScene(material, camera)
    const snake = new SnakeScene(snakeMaterial, camera)
    const params = new URLSearchParams(globalThis.location.search)
    const requested = params.get('scene')
    const mode: BallsMode = params.get('mode') === 'nodes' ? 'nodes' : 'single'
    const requestedCount = Number(params.get('count') ?? 1000)
    const count = Number.isFinite(requestedCount)
      ? Math.min(20000, Math.max(1, Math.floor(requestedCount)))
      : 1000
    const balls = new BallsScene(snakeMaterial, camera, mode, count)
    let initial: Node2D = main
    if (requested === 'snake') initial = snake
    else if (requested === 'balls') initial = balls
    super({ initial, dependencies: [{ type: MyInputModule }] })
    this.camera = camera
    this.main = main
    this.snake = snake
    this.balls = balls
  }

  protected override onDestroy(): void {
    super.onDestroy()
    if (!this.camera.destroyed) this.camera.destroy()
  }
}
