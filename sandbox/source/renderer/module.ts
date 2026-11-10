import {
  NodeRenderSpace,
  type RenderBackend,
  RendererModule,
  RenderSpacePriority,
  RenderTarget,
  Vector2,
} from '@dotm4x/fable'

import { type MyScenesModule } from '../scenes/module.js'

import { PostProcessPass } from './post-process.js'

/**
 * Renders the active scene into a multisampled offscreen target, then
 * composites it through a post-processing pass.
 */
export class MyRendererModule extends RendererModule {
  private readonly _target: RenderTarget

  public constructor(backend: RenderBackend, scenes: MyScenesModule) {
    const params = new URLSearchParams(globalThis.location.search)
    const direct = params.get('target') === '0'
    const samples = Number(params.get('samples') ?? 4)
    const target = new RenderTarget(new Vector2(640, 360), {
      sampleCount: Number.isFinite(samples) && samples >= 1 ? Math.floor(samples) : 4,
    })
    super({
      backend,
      spaces: [
        new NodeRenderSpace({
          identifier: 'scene',
          camera: scenes.camera,
          priority: RenderSpacePriority.low,
          cull: params.get('cull') !== '0',
          ...(direct ? {} : { target }),
          scenes,
        }),
      ],
      passes: direct ? [] : [new PostProcessPass(target)],
    })
    this._target = target
  }

  protected override onDestroy(): void {
    super.onDestroy()
    if (!this._target.destroyed) this._target.destroy()
  }
}
