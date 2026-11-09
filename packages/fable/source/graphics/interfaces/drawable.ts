import { type DrawData } from '../data.js'

import { type DrawContext } from './context.js'

/**
 * An object that can produce drawing data during a frame.
 *
 * Drawables describe their graphical representation without executing drawing
 * operations or depending on a specific rendering backend.
 */
export interface Drawable {
  /**
   * Produces the drawing data for this object.
   *
   * @param context - Frame state available while drawing.
   * @returns The drawing data with the commands required to represent this object.
   */
  draw(context: DrawContext): DrawData
}
