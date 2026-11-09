import { type Vector2 } from '#/math/primitives/vectors/vector2.js'

/**
 * A rectangular region within a rendering target.
 *
 * The viewport is immutable and compared by value.
 */
export class Viewport {
  /** Position of the viewport within its rendering target. */
  public readonly position: Vector2

  /** Size of the viewport in rendering-target units. */
  public readonly size: Vector2

  /**
   * @param position - The position of the viewport within its rendering target.
   * @param size - The size of the viewport in rendering-target units.
   */
  public constructor(position: Vector2, size: Vector2) {
    this.position = position
    this.size = size
  }

  /** Aspect ratio, calculated as width divided by height, or zero when the height is zero. */
  public get aspectRatio(): number {
    return this.size.y === 0 ? 0 : this.size.x / this.size.y
  }

  /**
   * Compares this viewport with another by value.
   *
   * @param other - The viewport to compare with.
   * @param tolerance - Absolute tolerance used for the position and size.
   * @returns Whether both viewports have equal position and size.
   */
  public equals(other: Viewport, tolerance = 1e-10): boolean {
    return (
      this.position.equals(other.position, tolerance) && this.size.equals(other.size, tolerance)
    )
  }
}
