/**
 * Timing information for a scheduled channel update, which may differ from
 * the time module's main loop.
 */
export interface UpdateContext {
  /** Simulated time represented by this update, in seconds. */
  readonly deltaTime: number

  /**
   * Effective target updates per second: the lower positive channel or
   * module target, or zero when neither imposes a limit. Actual updates
   * may be slower.
   */
  readonly updateRate: number
}
