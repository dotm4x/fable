import {
  type AssetsModule,
  Game,
  type GraphicMaterial,
  type Module,
  type RenderBackend,
  type Updatable,
  type UpdateContext,
} from '@dotm4x/fable'

import { MyInputModule } from './input/module.js'
import { MyRendererModule } from './renderer/module.js'
import { MyScenesModule } from './scenes/module.js'
import { MyTimeModule } from './time/module.js'

export class Sandbox extends Game implements Updatable {
  public time: MyTimeModule
  public scenes: MyScenesModule
  public input: MyInputModule
  public renderer: MyRendererModule
  public assets: AssetsModule
  public frames: number = 0

  public constructor(backend: RenderBackend, material: GraphicMaterial, assets: AssetsModule) {
    super()
    this.scenes = new MyScenesModule(material, backend.defaultMaterial)
    this.time = new MyTimeModule(this, this.scenes)
    this.input = new MyInputModule({ target: document.body })
    this.renderer = new MyRendererModule(backend, this.scenes)
    this.assets = assets
  }

  public update(context: UpdateContext): void {
    this.renderer.update(context)
    this.frames++
    const updates = document.querySelector('#updates')
    if (updates !== null) updates.textContent = String(this.frames)
    const delta = document.querySelector('#delta')
    if (delta !== null) delta.textContent = context.deltaTime.toFixed(3)
    const draws = document.querySelector('#draws')
    if (draws !== null) draws.textContent = String(this.renderer.backend.stats.drawCalls)
    const commands = document.querySelector('#commands')
    if (commands !== null) commands.textContent = String(this.renderer.backend.stats.commands)
  }

  protected override *compose(): Generator<Module> {
    yield this.time
    yield this.scenes
    yield this.input
    yield this.renderer
    yield this.assets
  }
}
