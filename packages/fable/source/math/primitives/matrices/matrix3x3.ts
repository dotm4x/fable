import { Vector3 } from '../vectors/vector3.js'

/**
 * An immutable linear transformation matrix for three-dimensional space.
 *
 * Rows hold the linear part of a transformation, matching the upper-left block
 * of `Matrix4x4`. Points are treated as row vectors, so {@link multiply}
 * applies this matrix before the argument.
 */
export class Matrix3x3 {
  /** The value in the first row and first column. */
  public readonly m11: number

  /** The value in the first row and second column. */
  public readonly m12: number

  /** The value in the first row and third column. */
  public readonly m13: number

  /** The value in the second row and first column. */
  public readonly m21: number

  /** The value in the second row and second column. */
  public readonly m22: number

  /** The value in the second row and third column. */
  public readonly m23: number

  /** The value in the third row and first column. */
  public readonly m31: number

  /** The value in the third row and second column. */
  public readonly m32: number

  /** The value in the third row and third column. */
  public readonly m33: number

  /**
   * Creates a three-by-three linear transformation matrix.
   *
   * @param m11 - The value in the first row and first column.
   * @param m12 - The value in the first row and second column.
   * @param m13 - The value in the first row and third column.
   * @param m21 - The value in the second row and first column.
   * @param m22 - The value in the second row and second column.
   * @param m23 - The value in the second row and third column.
   * @param m31 - The value in the third row and first column.
   * @param m32 - The value in the third row and second column.
   * @param m33 - The value in the third row and third column.
   */
  public constructor(
    m11: number,
    m12: number,
    m13: number,
    m21: number,
    m22: number,
    m23: number,
    m31: number,
    m32: number,
    m33: number,
  ) {
    this.m11 = m11
    this.m12 = m12
    this.m13 = m13
    this.m21 = m21
    this.m22 = m22
    this.m23 = m23
    this.m31 = m31
    this.m32 = m32
    this.m33 = m33
  }

  /** The identity transformation. */
  public static get identity(): Matrix3x3 {
    return new Matrix3x3(1, 0, 0, 0, 1, 0, 0, 0, 1)
  }

  /**
   * Creates a scale.
   *
   * @param x - The horizontal factor.
   * @param y - The vertical factor.
   * @param z - The depth factor.
   * @returns The scale matrix.
   */
  public static scaling(x: number, y: number, z: number): Matrix3x3 {
    return new Matrix3x3(x, 0, 0, 0, y, 0, 0, 0, z)
  }

  /**
   * Creates a rotation around the x axis.
   *
   * @param radians - The rotation angle in radians.
   * @returns The rotation matrix.
   */
  public static rotationX(radians: number): Matrix3x3 {
    const cosine = Math.cos(radians)
    const sine = Math.sin(radians)

    return new Matrix3x3(1, 0, 0, 0, cosine, sine, 0, -sine, cosine)
  }

  /**
   * Creates a rotation around the y axis.
   *
   * @param radians - The rotation angle in radians.
   * @returns The rotation matrix.
   */
  public static rotationY(radians: number): Matrix3x3 {
    const cosine = Math.cos(radians)
    const sine = Math.sin(radians)

    return new Matrix3x3(cosine, 0, -sine, 0, 1, 0, sine, 0, cosine)
  }

  /**
   * Creates a rotation around the z axis.
   *
   * @param radians - The rotation angle in radians.
   * @returns The rotation matrix.
   */
  public static rotationZ(radians: number): Matrix3x3 {
    const cosine = Math.cos(radians)
    const sine = Math.sin(radians)

    return new Matrix3x3(cosine, sine, 0, -sine, cosine, 0, 0, 0, 1)
  }

  /**
   * Multiplies this matrix by another, applying this matrix first.
   *
   * @param other - The matrix applied after this one.
   * @returns The combined transformation.
   */
  public multiply(other: Matrix3x3): Matrix3x3 {
    return new Matrix3x3(
      this.m11 * other.m11 + this.m12 * other.m21 + this.m13 * other.m31,
      this.m11 * other.m12 + this.m12 * other.m22 + this.m13 * other.m32,
      this.m11 * other.m13 + this.m12 * other.m23 + this.m13 * other.m33,
      this.m21 * other.m11 + this.m22 * other.m21 + this.m23 * other.m31,
      this.m21 * other.m12 + this.m22 * other.m22 + this.m23 * other.m32,
      this.m21 * other.m13 + this.m22 * other.m23 + this.m23 * other.m33,
      this.m31 * other.m11 + this.m32 * other.m21 + this.m33 * other.m31,
      this.m31 * other.m12 + this.m32 * other.m22 + this.m33 * other.m32,
      this.m31 * other.m13 + this.m32 * other.m23 + this.m33 * other.m33,
    )
  }

  /**
   * Inverts this matrix.
   *
   * @returns The inverse transformation, or undefined when this matrix is singular.
   */
  public invert(): Matrix3x3 | undefined {
    const determinant =
      this.m11 * (this.m22 * this.m33 - this.m23 * this.m32) -
      this.m12 * (this.m21 * this.m33 - this.m23 * this.m31) +
      this.m13 * (this.m21 * this.m32 - this.m22 * this.m31)
    if (!Number.isFinite(determinant) || determinant === 0) {
      return undefined
    }

    const inverseDeterminant = 1 / determinant

    return new Matrix3x3(
      (this.m22 * this.m33 - this.m23 * this.m32) * inverseDeterminant,
      (this.m13 * this.m32 - this.m12 * this.m33) * inverseDeterminant,
      (this.m12 * this.m23 - this.m13 * this.m22) * inverseDeterminant,
      (this.m23 * this.m31 - this.m21 * this.m33) * inverseDeterminant,
      (this.m11 * this.m33 - this.m13 * this.m31) * inverseDeterminant,
      (this.m13 * this.m21 - this.m11 * this.m23) * inverseDeterminant,
      (this.m21 * this.m32 - this.m22 * this.m31) * inverseDeterminant,
      (this.m12 * this.m31 - this.m11 * this.m32) * inverseDeterminant,
      (this.m11 * this.m22 - this.m12 * this.m21) * inverseDeterminant,
    )
  }

  /**
   * Applies this transformation to a vector.
   *
   * @param vector - The vector to transform.
   * @returns The transformed vector, without mutating the argument.
   */
  public transform(vector: Vector3): Vector3 {
    return new Vector3(
      vector.x * this.m11 + vector.y * this.m21 + vector.z * this.m31,
      vector.x * this.m12 + vector.y * this.m22 + vector.z * this.m32,
      vector.x * this.m13 + vector.y * this.m23 + vector.z * this.m33,
    )
  }
}
