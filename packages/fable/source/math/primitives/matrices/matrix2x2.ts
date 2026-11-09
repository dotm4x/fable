import { Vector2 } from '../vectors/vector2.js'

/**
 * An immutable linear transformation matrix for two-dimensional space.
 *
 * Rows hold the linear part of a transformation, matching the upper-left block
 * of `Matrix3x2`. Points are treated as row vectors, so {@link multiply}
 * applies this matrix before the argument.
 */
export class Matrix2x2 {
  /** The value in the first row and first column. */
  public readonly m11: number

  /** The value in the first row and second column. */
  public readonly m12: number

  /** The value in the second row and first column. */
  public readonly m21: number

  /** The value in the second row and second column. */
  public readonly m22: number

  /**
   * Creates a two-by-two linear transformation matrix.
   *
   * @param m11 - The value in the first row and first column.
   * @param m12 - The value in the first row and second column.
   * @param m21 - The value in the second row and first column.
   * @param m22 - The value in the second row and second column.
   */
  public constructor(m11: number, m12: number, m21: number, m22: number) {
    this.m11 = m11
    this.m12 = m12
    this.m21 = m21
    this.m22 = m22
  }

  /** The identity transformation. */
  public static get identity(): Matrix2x2 {
    return new Matrix2x2(1, 0, 0, 1)
  }

  /**
   * Creates a scale.
   *
   * @param x - The horizontal factor.
   * @param y - The vertical factor.
   * @returns The scale matrix.
   */
  public static scaling(x: number, y: number): Matrix2x2 {
    return new Matrix2x2(x, 0, 0, y)
  }

  /**
   * Creates a rotation.
   *
   * @param radians - The rotation angle in radians.
   * @returns The rotation matrix.
   */
  public static rotation(radians: number): Matrix2x2 {
    const cosine = Math.cos(radians)
    const sine = Math.sin(radians)

    return new Matrix2x2(cosine, sine, -sine, cosine)
  }

  /**
   * Multiplies this matrix by another, applying this matrix first.
   *
   * @param other - The matrix applied after this one.
   * @returns The combined transformation.
   */
  public multiply(other: Matrix2x2): Matrix2x2 {
    return new Matrix2x2(
      this.m11 * other.m11 + this.m12 * other.m21,
      this.m11 * other.m12 + this.m12 * other.m22,
      this.m21 * other.m11 + this.m22 * other.m21,
      this.m21 * other.m12 + this.m22 * other.m22,
    )
  }

  /**
   * Inverts this matrix.
   *
   * @returns The inverse transformation, or undefined when this matrix is singular.
   */
  public invert(): Matrix2x2 | undefined {
    const determinant = this.m11 * this.m22 - this.m21 * this.m12
    if (!Number.isFinite(determinant) || determinant === 0) {
      return undefined
    }

    const inverseDeterminant = 1 / determinant

    return new Matrix2x2(
      this.m22 * inverseDeterminant,
      -this.m12 * inverseDeterminant,
      -this.m21 * inverseDeterminant,
      this.m11 * inverseDeterminant,
    )
  }

  /**
   * Applies this transformation to a vector.
   *
   * @param vector - The vector to transform.
   * @returns The transformed vector, without mutating the argument.
   */
  public transform(vector: Vector2): Vector2 {
    return new Vector2(
      vector.x * this.m11 + vector.y * this.m21,
      vector.x * this.m12 + vector.y * this.m22,
    )
  }
}
