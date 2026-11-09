import { BaseVector } from './vector.js'

/**
 * An immutable three-dimensional vector with `x`, `y`, and `z` components.
 *
 * Arithmetic methods return new `Vector3` instances.
 */
export class Vector3 extends BaseVector<Vector3> {
  /** The horizontal component. */
  public readonly x: number

  /** The vertical component. */
  public readonly y: number

  /** The depth component. */
  public readonly z: number

  /**
   * Creates a three-dimensional vector.
   *
   * @param x - The horizontal component.
   * @param y - The vertical component.
   * @param z - The depth component.
   */
  public constructor(x: number, y: number, z: number) {
    super()
    this.x = x
    this.y = y
    this.z = z
  }

  /** @inheritDoc */
  protected get components(): readonly [number, number, number] {
    return [this.x, this.y, this.z]
  }

  /** @inheritDoc */
  protected create(components: readonly number[]): Vector3 {
    return new Vector3(
      this.componentAt(components, 0),
      this.componentAt(components, 1),
      this.componentAt(components, 2),
    )
  }
}
