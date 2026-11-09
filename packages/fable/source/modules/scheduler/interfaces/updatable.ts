import { type UpdateContext } from '../context.js'

/** An object that can receive scheduled updates. */
export interface Updatable {
  /**
   * Updates this object using the timing information for the current channel.
   *
   * @param context - Timing information for the update.
   */
  update(context: UpdateContext): void
}
