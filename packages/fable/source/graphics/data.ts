import { type DrawCommand } from './commands/command.js'

/**
 * The ordered drawing commands produced by a drawable object.
 *
 * Commands are copied and frozen, then executed by the drawing system in the
 * order in which they appear. Drawing data does not execute commands or depend
 * on a specific rendering backend.
 */
export class DrawData {
  /** Drawing commands in execution order. */
  public readonly commands: readonly DrawCommand[]

  /**
   * @param commands - The drawing commands to include, in execution order.
   */
  public constructor(commands: Iterable<DrawCommand>) {
    this.commands = Object.freeze([...commands])
  }
}
