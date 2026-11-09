import { type Color } from '../primitives/color.js'

/**
 * A command to clear the current drawing target.
 */
export class ClearCommand {
  /** Color used to clear the target. */
  public readonly color: Color

  /**
   * @param color - The color used to clear the target.
   */
  public constructor(color: Color) {
    this.color = color
  }

  /**
   * Compares this command with another.
   *
   * @param other - The command to compare with.
   * @returns Whether both commands clear with an equal color.
   */
  public equals(other: ClearCommand): boolean {
    return this.color.equals(other.color)
  }
}
