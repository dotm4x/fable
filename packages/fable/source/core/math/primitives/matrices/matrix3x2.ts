import { Vector2 } from '../vectors/vector2.js'

/**
 * An immutable affine transformation matrix for two-dimensional space.
 *
 * The layout matches `System.Numerics.Matrix3x2`: the first two rows hold
 * rotation, scale and shear, and the third row holds translation. Points are
 * treated as row vectors, so {@link transform} applies translation last and
 * {@link multiply} applies this matrix before the argument.
 */
export class Matrix3x2 {
  /** The value in the first row and first column. */
  public readonly m11: number

  /** The value in the first row and second column. */
  public readonly m12: number

  /** The value in the second row and first column. */
  public readonly m21: number

  /** The value in the second row and second column. */
  public readonly m22: number

  /** The horizontal translation in the third row. */
  public readonly m31: number

  /** The vertical translation in the third row. */
  public readonly m32: number

  /**
   * Creates an affine transformation matrix.
   *
   * @param m11 - The value in the first row and first column.
   * @param m12 - The value in the first row and second column.
   * @param m21 - The value in the second row and first column.
   * @param m22 - The value in the second row and second column.
   * @param m31 - The horizontal translation.
   * @param m32 - The vertical translation.
   */
  public constructor(m11: number, m12: number, m21: number, m22: number, m31: number, m32: number) {
    this.m11 = m11
    this.m12 = m12
    this.m21 = m21
    this.m22 = m22
    this.m31 = m31
    this.m32 = m32
  }

  /** The identity transformation. */
  public static get identity(): Matrix3x2 {
    return new Matrix3x2(1, 0, 0, 1, 0, 0)
  }

  /**
   * Creates a translation.
   *
   * @param x - The horizontal offset.
   * @param y - The vertical offset.
   * @returns The translation matrix.
   */
  public static translation(x: number, y: number): Matrix3x2 {
    return new Matrix3x2(1, 0, 0, 1, x, y)
  }

  /**
   * Creates a scale.
   *
   * @param x - The horizontal factor.
   * @param y - The vertical factor.
   * @returns The scale matrix.
   */
  public static scaling(x: number, y: number): Matrix3x2 {
    return new Matrix3x2(x, 0, 0, y, 0, 0)
  }

  /**
   * Creates a rotation.
   *
   * @param radians - The rotation angle in radians.
   * @returns The rotation matrix.
   */
  public static rotation(radians: number): Matrix3x2 {
    const cosine = Math.cos(radians)
    const sine = Math.sin(radians)

    return new Matrix3x2(cosine, sine, -sine, cosine, 0, 0)
  }

  /**
   * Multiplies this matrix by another, applying this matrix first.
   *
   * @param other - The matrix applied after this one.
   * @returns The combined transformation.
   */
  public multiply(other: Matrix3x2): Matrix3x2 {
    return new Matrix3x2(
      this.m11 * other.m11 + this.m12 * other.m21,
      this.m11 * other.m12 + this.m12 * other.m22,
      this.m21 * other.m11 + this.m22 * other.m21,
      this.m21 * other.m12 + this.m22 * other.m22,
      this.m31 * other.m11 + this.m32 * other.m21 + other.m31,
      this.m31 * other.m12 + this.m32 * other.m22 + other.m32,
    )
  }

  /**
   * Inverts this matrix.
   *
   * @returns The inverse transformation, or undefined when this matrix is singular.
   */
  public invert(): Matrix3x2 | undefined {
    const determinant = this.m11 * this.m22 - this.m21 * this.m12
    if (!Number.isFinite(determinant) || determinant === 0) {
      return undefined
    }

    const inverseDeterminant = 1 / determinant

    return new Matrix3x2(
      this.m22 * inverseDeterminant,
      -this.m12 * inverseDeterminant,
      -this.m21 * inverseDeterminant,
      this.m11 * inverseDeterminant,
      (this.m21 * this.m32 - this.m22 * this.m31) * inverseDeterminant,
      (this.m12 * this.m31 - this.m11 * this.m32) * inverseDeterminant,
    )
  }

  /**
   * Applies this transformation to a point.
   *
   * @param point - The point to transform.
   * @returns The transformed point, without mutating the argument.
   */
  public transform(point: Vector2): Vector2 {
    return new Vector2(
      point.x * this.m11 + point.y * this.m21 + this.m31,
      point.x * this.m12 + point.y * this.m22 + this.m32,
    )
  }
}
