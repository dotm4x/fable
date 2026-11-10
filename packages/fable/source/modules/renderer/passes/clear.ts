import { ClearCommand } from '#/graphics/commands/clear.js'
import { type RenderTarget } from '#/graphics/resources/targets/target.js'

import { RenderPass, type RenderPassContext, RenderPassPriority } from './pass.js'

/** Identifier of the pass that clears the drawing surfaces of a frame. */
export const clearRenderPassIdentifier = 'org.js.fable.ClearRenderPass'

/**
 * Clears the window and every offscreen target used by the frame, once each.
 *
 * Spaces that draw to the same target share a single clear, so targets keep
 * their contents until the space with their lowest priority runs.
 */
export class ClearRenderPass extends RenderPass {
  /**
   * @param identifier - Pass identifier.
   * @param priority - Execution order. Defaults to low.
   */
  public constructor(
    identifier: string = clearRenderPassIdentifier,
    priority: RenderPassPriority = RenderPassPriority.low,
  ) {
    super(identifier, priority)
  }

  /** @inheritDoc */
  public execute({ backend, clearColor, spaces }: RenderPassContext): void {
    this.throwIfDestroyed()
    const clear = new ClearCommand(clearColor)
    const cleared = new Set<RenderTarget>()
    backend.render([clear])
    for (const space of spaces) {
      const target = space.target.value
      if (target === undefined || cleared.has(target)) continue
      cleared.add(target)
      backend.render([clear], undefined, target)
    }
  }
}
