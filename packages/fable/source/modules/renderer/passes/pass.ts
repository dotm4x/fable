import { type Identifiable } from '#/core/interfaces/identifiable.js'
import { Destroyable } from '#/core/primitives/destroyable.js'
import { type Color } from '#/graphics/primitives/color.js'

import { type RenderBackend } from '../backends/backend.js'
import { type RenderSpace } from '../spaces/space.js'

/** Ordering of rendering passes. Lower priorities execute first. */
export enum RenderPassPriority {
  low,
  normal,
  high,
  critical,
}

/** Frame state offered to rendering passes. */
export interface RenderPassContext {
  /** Backend executing the frame. */
  readonly backend: RenderBackend

  /** Delta time offered to drawable objects, in seconds. */
  readonly deltaTime: number

  /** Color used to clear drawing surfaces. */
  readonly clearColor: Color

  /** Spaces to draw, sorted by ascending priority. */
  readonly spaces: readonly RenderSpace[]
}

/**
 * A step of the rendering pipeline.
 *
 * Passes execute in ascending priority order inside the frame owned by the
 * renderer, so a pass can clear surfaces, draw spaces or apply effects. The
 * renderer owns registered passes and destroys them with itself.
 */
export abstract class RenderPass extends Destroyable implements Identifiable<string> {
  /** Unique pass identifier. */
  public readonly identifier: string

  /** Execution order. Lower priorities execute first. */
  public readonly priority: RenderPassPriority

  /**
   * @param identifier - The nonempty pass identifier.
   * @param priority - Execution order. Defaults to normal.
   * @throws {@link Error} If the identifier is empty.
   */
  protected constructor(
    identifier: string,
    priority: RenderPassPriority = RenderPassPriority.normal,
  ) {
    super()
    if (!identifier.trim()) {
      throw new Error('Render pass identifier must not be empty.')
    }

    this.identifier = identifier
    this.priority = priority
  }

  /**
   * Executes the pass inside the active frame.
   *
   * @param context - Frame state shared by the passes of the frame.
   */
  public abstract execute(context: RenderPassContext): void
}
