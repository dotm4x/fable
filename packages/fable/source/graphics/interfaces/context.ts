import { type Viewport } from '../primitives/viewport.js'

import { type Camera } from './camera.js'

/**
 * The state available while producing drawing data for a frame.
 *
 * A drawing context contains frame-specific state used by drawable objects to
 * produce {@link DrawData}. It does not execute drawing operations or depend on
 * a specific rendering backend.
 */
export interface DrawContext {
  /**
   * Camera used to draw the current view.
   *
   * The camera is required; views without a camera are rejected before their
   * commands are produced.
   */
  readonly camera: Camera

  /**
   * Delta time of the update that produced the current frame, in seconds.
   *
   * The value comes from the update that drives drawing and is not necessarily
   * the elapsed time between two frames.
   */
  readonly deltaTime: number

  /** Viewport in which the current view is drawn. */
  readonly viewport: Viewport
}
