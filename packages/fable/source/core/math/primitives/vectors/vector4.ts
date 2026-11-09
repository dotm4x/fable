import { BaseVector } from './vector.js'

/**
 * An immutable four-dimensional vector with `x`, `y`, `z`, and `w` components.
 *
 * Arithmetic methods return new `Vector4` instances.
 */
export class Vector4 extends BaseVector<Vector4> {
  /** The horizontal component. */
  public readonly x: number

  /** The vertical component. */
  public readonly y: number

  /** The depth component. */
  public readonly z: number

  /** The fourth component. */
  public readonly w: number

  /**
   * Creates a four-dimensional vector.
   *
   * @param x - The horizontal component.
   * @param y - The vertical component.
   * @param z - The depth component.
   * @param w - The fourth component.
   */
  public constructor(x: number, y: number, z: number, w: number) {
    super()
    this.x = x
    this.y = y
    this.z = z
    this.w = w
  }

  /** @inheritDoc */
  protected get components(): readonly [number, number, number, number] {
    return [this.x, this.y, this.z, this.w]
  }

  /** @inheritDoc */
  protected create(components: readonly number[]): Vector4 {
    return new Vector4(
      this.componentAt(components, 0),
      this.componentAt(components, 1),
      this.componentAt(components, 2),
      this.componentAt(components, 3),
    )
  }
}
