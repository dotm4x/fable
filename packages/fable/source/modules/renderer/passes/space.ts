import { Viewport } from '#/graphics/primitives/viewport.js'
import { Vector2 } from '#/math/primitives/vectors/vector2.js'

import { RenderContext } from '../context.js'

import { RenderPass, type RenderPassContext, RenderPassPriority } from './pass.js'

/** Identifier of the pass that draws registered spaces. */
export const spaceRenderPassIdentifier = 'org.js.fable.SpaceRenderPass'

/**
 * Collects and draws every space of the frame in priority order.
 *
 * Each space is drawn with its own camera, viewport and offscreen target. The
 * pass does not clear surfaces; {@link ClearRenderPass} does it beforehand.
 */
export class SpaceRenderPass extends RenderPass {
  /**
   * @param identifier - Pass identifier.
   * @param priority - Execution order. Defaults to normal.
   */
  public constructor(
    identifier: string = spaceRenderPassIdentifier,
    priority: RenderPassPriority = RenderPassPriority.normal,
  ) {
    super(identifier, priority)
  }

  /** @inheritDoc */
  public execute({ backend, deltaTime, spaces }: RenderPassContext): void {
    this.throwIfDestroyed()
    for (const space of spaces) {
      const target = space.target.value
      const viewport =
        space.viewport.value ??
        (target === undefined ? backend.viewport : new Viewport(new Vector2(0, 0), target.size))
      const context = new RenderContext(deltaTime, space.camera.value, viewport)
      backend.render(space.collect(context), context, target)
    }
  }
}
