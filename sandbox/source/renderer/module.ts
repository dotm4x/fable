import {
  Camera2D,
  Color,
  NodeRenderSpace,
  type RenderBackend,
  RendererModule,
  RenderSpace,
  RenderSpacePriority,
  RenderTarget,
  TextureBinding,
  TextureSampler,
  Vector2,
} from '@dotm4x/fable'

import { type MyScenesModule } from '../scenes/module.js'

import { CompositeNode } from './composite.js'

/**
 * Renders the active scene into an offscreen target, then composites that
 * target onto the canvas.
 */
export class MyRendererModule extends RendererModule {
  private readonly _target: RenderTarget

  public constructor(backend: RenderBackend, scenes: MyScenesModule) {
    const target = new RenderTarget(new Vector2(640, 360))
    const composite = new RenderSpace({
      identifier: 'composite',
      camera: new Camera2D(),
      entries: [
        new CompositeNode(
          backend.createMaterial([new TextureBinding(target, new TextureSampler())]),
        ),
      ],
    })
    super({
      backend,
      spaces: [
        new NodeRenderSpace({
          identifier: 'scene',
          camera: scenes.main.camera,
          priority: RenderSpacePriority.low,
          target,
          scenes,
        }),
        composite,
      ],
      clearColor: new Color(0.06, 0.07, 0.1),
    })
    this._target = target
  }

  protected override onDestroy(): void {
    super.onDestroy()
    if (!this._target.destroyed) this._target.destroy()
  }
}
