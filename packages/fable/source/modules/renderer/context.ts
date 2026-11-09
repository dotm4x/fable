import { type Camera } from '#/graphics/interfaces/camera.js'
import { type DrawContext } from '#/graphics/interfaces/context.js'
import { type Viewport } from '#/graphics/primitives/viewport.js'

/**
 * Frame state offered to drawable objects.
 *
 * The context does not execute commands and does not depend on a backend.
 */
export class RenderContext implements DrawContext {
  /** Delta time of the update producing the frame, in seconds. */
  public readonly deltaTime: number

  /** Camera used to draw the current view. */
  public readonly camera: Camera

  /** Viewport in which the current view is drawn. */
  public readonly viewport: Viewport

  /**
   * @param deltaTime - Delta time of the update producing the frame, in seconds.
   * @param camera - Camera used to draw the current view.
   * @param viewport - Viewport in which the current view is drawn.
   */
  public constructor(deltaTime: number, camera: Camera, viewport: Viewport) {
    this.deltaTime = deltaTime
    this.camera = camera
    this.viewport = viewport
  }
}
