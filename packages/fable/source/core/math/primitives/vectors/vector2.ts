import { BaseVector } from './vector.js'

/**
 * An immutable two-dimensional vector with `x` and `y` components.
 *
 * Arithmetic methods return new `Vector2` instances.
 */
export class Vector2 extends BaseVector<Vector2> {
  /** The horizontal component. */
  public readonly x: number

  /** The vertical component. */
  public readonly y: number

  /**
   * Creates a two-dimensional vector.
   *
   * @param x - The horizontal component.
   * @param y - The vertical component.
   */
  public constructor(x: number, y: number) {
    super()
    this.x = x
    this.y = y
  }

  /** @inheritDoc */
  protected get components(): readonly [number, number] {
    return [this.x, this.y]
  }

  /** @inheritDoc */
  protected create(components: readonly number[]): Vector2 {
    return new Vector2(this.componentAt(components, 0), this.componentAt(components, 1))
  }
}
