import { Vector2 } from '../primitives/vectors/vector2.js'

/** An axis-aligned two-dimensional bounding box. */
export class Bounds2 {
  /** Minimum corner. */
  public readonly min: Vector2

  /** Maximum corner. */
  public readonly max: Vector2

  /**
   * @param min - Minimum corner.
   * @param max - Maximum corner; each component must be greater than or equal to `min`.
   * @throws {@link RangeError} If a maximum component is below its minimum.
   */
  public constructor(min: Vector2, max: Vector2) {
    if (max.x < min.x || max.y < min.y) {
      throw new RangeError('Bounds maximum must not be below the minimum.')
    }
    this.min = min
    this.max = max
  }

  /** Width and height of the bounds. */
  public get size(): Vector2 {
    return new Vector2(this.max.x - this.min.x, this.max.y - this.min.y)
  }

  /** Center of the bounds. */
  public get center(): Vector2 {
    return new Vector2((this.min.x + this.max.x) / 2, (this.min.y + this.max.y) / 2)
  }

  /**
   * Checks whether a point lies inside the bounds, including their edges.
   *
   * @param point - The point to check.
   * @returns Whether the point is contained.
   */
  public contains(point: Vector2): boolean {
    return (
      point.x >= this.min.x &&
      point.x <= this.max.x &&
      point.y >= this.min.y &&
      point.y <= this.max.y
    )
  }

  /**
   * Checks whether two bounds overlap, including their edges.
   *
   * @param other - The bounds to test.
   * @returns Whether the bounds intersect.
   */
  public intersects(other: Bounds2): boolean {
    return (
      this.min.x <= other.max.x &&
      this.max.x >= other.min.x &&
      this.min.y <= other.max.y &&
      this.max.y >= other.min.y
    )
  }

  /**
   * Creates the bounds that contain every point.
   *
   * @param points - The points to enclose.
   * @returns The enclosing bounds.
   * @throws {@link Error} If no points are supplied.
   */
  public static fromPoints(points: Iterable<Vector2>): Bounds2 {
    let minimumX = Number.POSITIVE_INFINITY
    let minimumY = Number.POSITIVE_INFINITY
    let maximumX = Number.NEGATIVE_INFINITY
    let maximumY = Number.NEGATIVE_INFINITY
    let count = 0
    for (const point of points) {
      minimumX = Math.min(minimumX, point.x)
      minimumY = Math.min(minimumY, point.y)
      maximumX = Math.max(maximumX, point.x)
      maximumY = Math.max(maximumY, point.y)
      count++
    }
    if (count === 0) {
      throw new Error('Bounds require at least one point.')
    }

    return new Bounds2(new Vector2(minimumX, minimumY), new Vector2(maximumX, maximumY))
  }
}
