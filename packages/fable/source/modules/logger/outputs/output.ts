import { Destroyable } from '#/core/primitives/destroyable.js'

import { type LogMessage } from '../message.js'

/** Higher-priority outputs receive messages first. */
export enum LogOutputPriority {
  low = 25,
  normal = 50,
  high = 75,
  critical = 100,
}

/** An owned destination for log messages. */
export abstract class LogOutput extends Destroyable {
  /** Priority used when dispatching messages. */
  public readonly priority: LogOutputPriority

  public constructor(priority: LogOutputPriority = LogOutputPriority.normal) {
    super()
    if (!Number.isFinite(priority)) {
      throw new RangeError('Log output priority must be finite.')
    }

    this.priority = priority
  }

  /**
   * Processes a message.
   *
   * @param message - The message to dispatch.
   * @throws {@link Error} If this output has been destroyed.
   */
  public log(message: LogMessage): void {
    this.throwIfDestroyed()
    this.onLog(message)
  }

  /** Processes a message in this output. */
  protected abstract onLog(message: LogMessage): void
}
