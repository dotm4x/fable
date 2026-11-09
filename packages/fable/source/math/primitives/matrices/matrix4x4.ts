import { Vector4 } from '../vectors/vector4.js'

/**
 * An immutable affine transformation matrix for three-dimensional space.
 *
 * The layout matches `System.Numerics.Matrix4x4`: the first three rows hold
 * rotation, scale and shear, and the fourth row holds translation. Points are
 * treated as row vectors, so {@link transform} applies translation last and
 * {@link multiply} applies this matrix before the argument.
 */
export class Matrix4x4 {
  /** The value in the first row and first column. */
  public readonly m11: number

  /** The value in the first row and second column. */
  public readonly m12: number

  /** The value in the first row and third column. */
  public readonly m13: number

  /** The value in the first row and fourth column. */
  public readonly m14: number

  /** The value in the second row and first column. */
  public readonly m21: number

  /** The value in the second row and second column. */
  public readonly m22: number

  /** The value in the second row and third column. */
  public readonly m23: number

  /** The value in the second row and fourth column. */
  public readonly m24: number

  /** The value in the third row and first column. */
  public readonly m31: number

  /** The value in the third row and second column. */
  public readonly m32: number

  /** The value in the third row and third column. */
  public readonly m33: number

  /** The value in the third row and fourth column. */
  public readonly m34: number

  /** The horizontal translation in the fourth row. */
  public readonly m41: number

  /** The vertical translation in the fourth row. */
  public readonly m42: number

  /** The depth translation in the fourth row. */
  public readonly m43: number

  /** The homogeneous coordinate in the fourth row. */
  public readonly m44: number

  /**
   * Creates a four-by-four transformation matrix.
   *
   * @param m11 - The value in the first row and first column.
   * @param m12 - The value in the first row and second column.
   * @param m13 - The value in the first row and third column.
   * @param m14 - The value in the first row and fourth column.
   * @param m21 - The value in the second row and first column.
   * @param m22 - The value in the second row and second column.
   * @param m23 - The value in the second row and third column.
   * @param m24 - The value in the second row and fourth column.
   * @param m31 - The value in the third row and first column.
   * @param m32 - The value in the third row and second column.
   * @param m33 - The value in the third row and third column.
   * @param m34 - The value in the third row and fourth column.
   * @param m41 - The horizontal translation.
   * @param m42 - The vertical translation.
   * @param m43 - The depth translation.
   * @param m44 - The homogeneous coordinate.
   */
  public constructor(
    m11: number,
    m12: number,
    m13: number,
    m14: number,
    m21: number,
    m22: number,
    m23: number,
    m24: number,
    m31: number,
    m32: number,
    m33: number,
    m34: number,
    m41: number,
    m42: number,
    m43: number,
    m44: number,
  ) {
    this.m11 = m11
    this.m12 = m12
    this.m13 = m13
    this.m14 = m14
    this.m21 = m21
    this.m22 = m22
    this.m23 = m23
    this.m24 = m24
    this.m31 = m31
    this.m32 = m32
    this.m33 = m33
    this.m34 = m34
    this.m41 = m41
    this.m42 = m42
    this.m43 = m43
    this.m44 = m44
  }

  /** The identity transformation. */
  public static get identity(): Matrix4x4 {
    return new Matrix4x4(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)
  }

  /**
   * Creates a translation.
   *
   * @param x - The horizontal offset.
   * @param y - The vertical offset.
   * @param z - The depth offset.
   * @returns The translation matrix.
   */
  public static translation(x: number, y: number, z: number): Matrix4x4 {
    return new Matrix4x4(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1)
  }

  /**
   * Creates a scale.
   *
   * @param x - The horizontal factor.
   * @param y - The vertical factor.
   * @param z - The depth factor.
   * @returns The scale matrix.
   */
  public static scaling(x: number, y: number, z: number): Matrix4x4 {
    return new Matrix4x4(x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1)
  }

  /**
   * Creates a rotation around the x axis.
   *
   * @param radians - The rotation angle in radians.
   * @returns The rotation matrix.
   */
  public static rotationX(radians: number): Matrix4x4 {
    const cosine = Math.cos(radians)
    const sine = Math.sin(radians)

    return new Matrix4x4(1, 0, 0, 0, 0, cosine, sine, 0, 0, -sine, cosine, 0, 0, 0, 0, 1)
  }

  /**
   * Creates a rotation around the y axis.
   *
   * @param radians - The rotation angle in radians.
   * @returns The rotation matrix.
   */
  public static rotationY(radians: number): Matrix4x4 {
    const cosine = Math.cos(radians)
    const sine = Math.sin(radians)

    return new Matrix4x4(cosine, 0, -sine, 0, 0, 1, 0, 0, sine, 0, cosine, 0, 0, 0, 0, 1)
  }

  /**
   * Creates a rotation around the z axis.
   *
   * @param radians - The rotation angle in radians.
   * @returns The rotation matrix.
   */
  public static rotationZ(radians: number): Matrix4x4 {
    const cosine = Math.cos(radians)
    const sine = Math.sin(radians)

    return new Matrix4x4(cosine, sine, 0, 0, -sine, cosine, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)
  }

  /**
   * Multiplies this matrix by another, applying this matrix first.
   *
   * @param other - The matrix applied after this one.
   * @returns The combined transformation.
   */
  public multiply(other: Matrix4x4): Matrix4x4 {
    return new Matrix4x4(
      this.m11 * other.m11 + this.m12 * other.m21 + this.m13 * other.m31 + this.m14 * other.m41,
      this.m11 * other.m12 + this.m12 * other.m22 + this.m13 * other.m32 + this.m14 * other.m42,
      this.m11 * other.m13 + this.m12 * other.m23 + this.m13 * other.m33 + this.m14 * other.m43,
      this.m11 * other.m14 + this.m12 * other.m24 + this.m13 * other.m34 + this.m14 * other.m44,
      this.m21 * other.m11 + this.m22 * other.m21 + this.m23 * other.m31 + this.m24 * other.m41,
      this.m21 * other.m12 + this.m22 * other.m22 + this.m23 * other.m32 + this.m24 * other.m42,
      this.m21 * other.m13 + this.m22 * other.m23 + this.m23 * other.m33 + this.m24 * other.m43,
      this.m21 * other.m14 + this.m22 * other.m24 + this.m23 * other.m34 + this.m24 * other.m44,
      this.m31 * other.m11 + this.m32 * other.m21 + this.m33 * other.m31 + this.m34 * other.m41,
      this.m31 * other.m12 + this.m32 * other.m22 + this.m33 * other.m32 + this.m34 * other.m42,
      this.m31 * other.m13 + this.m32 * other.m23 + this.m33 * other.m33 + this.m34 * other.m43,
      this.m31 * other.m14 + this.m32 * other.m24 + this.m33 * other.m34 + this.m34 * other.m44,
      this.m41 * other.m11 + this.m42 * other.m21 + this.m43 * other.m31 + this.m44 * other.m41,
      this.m41 * other.m12 + this.m42 * other.m22 + this.m43 * other.m32 + this.m44 * other.m42,
      this.m41 * other.m13 + this.m42 * other.m23 + this.m43 * other.m33 + this.m44 * other.m43,
      this.m41 * other.m14 + this.m42 * other.m24 + this.m43 * other.m34 + this.m44 * other.m44,
    )
  }

  /**
   * Inverts this matrix.
   *
   * @returns The inverse transformation, or undefined when this matrix is singular.
   */
  public invert(): Matrix4x4 | undefined {
    const a00 = this.m11
    const a01 = this.m12
    const a02 = this.m13
    const a03 = this.m14
    const a10 = this.m21
    const a11 = this.m22
    const a12 = this.m23
    const a13 = this.m24
    const a20 = this.m31
    const a21 = this.m32
    const a22 = this.m33
    const a23 = this.m34
    const a30 = this.m41
    const a31 = this.m42
    const a32 = this.m43
    const a33 = this.m44

    const b00 = a00 * a11 - a01 * a10
    const b01 = a00 * a12 - a02 * a10
    const b02 = a00 * a13 - a03 * a10
    const b03 = a01 * a12 - a02 * a11
    const b04 = a01 * a13 - a03 * a11
    const b05 = a02 * a13 - a03 * a12
    const b06 = a20 * a31 - a21 * a30
    const b07 = a20 * a32 - a22 * a30
    const b08 = a20 * a33 - a23 * a30
    const b09 = a21 * a32 - a22 * a31
    const b10 = a21 * a33 - a23 * a31
    const b11 = a22 * a33 - a23 * a32

    const determinant = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06
    if (!Number.isFinite(determinant) || determinant === 0) {
      return undefined
    }

    const inverseDeterminant = 1 / determinant

    return new Matrix4x4(
      (a11 * b11 - a12 * b10 + a13 * b09) * inverseDeterminant,
      (a02 * b10 - a01 * b11 - a03 * b09) * inverseDeterminant,
      (a31 * b05 - a32 * b04 + a33 * b03) * inverseDeterminant,
      (a22 * b04 - a21 * b05 - a23 * b03) * inverseDeterminant,
      (a12 * b08 - a10 * b11 - a13 * b07) * inverseDeterminant,
      (a00 * b11 - a02 * b08 + a03 * b07) * inverseDeterminant,
      (a32 * b02 - a30 * b05 - a33 * b01) * inverseDeterminant,
      (a20 * b05 - a22 * b02 + a23 * b01) * inverseDeterminant,
      (a10 * b10 - a11 * b08 + a13 * b06) * inverseDeterminant,
      (a01 * b08 - a00 * b10 - a03 * b06) * inverseDeterminant,
      (a30 * b04 - a31 * b02 + a33 * b00) * inverseDeterminant,
      (a21 * b02 - a20 * b04 - a23 * b00) * inverseDeterminant,
      (a11 * b07 - a10 * b09 - a12 * b06) * inverseDeterminant,
      (a00 * b09 - a01 * b07 + a02 * b06) * inverseDeterminant,
      (a31 * b01 - a30 * b03 - a32 * b00) * inverseDeterminant,
      (a20 * b03 - a21 * b01 + a22 * b00) * inverseDeterminant,
    )
  }

  /**
   * Applies this transformation to a point.
   *
   * @param point - The point to transform.
   * @returns The transformed point, without mutating the argument.
   */
  public transform(point: Vector4): Vector4 {
    return new Vector4(
      point.x * this.m11 + point.y * this.m21 + point.z * this.m31 + point.w * this.m41,
      point.x * this.m12 + point.y * this.m22 + point.z * this.m32 + point.w * this.m42,
      point.x * this.m13 + point.y * this.m23 + point.z * this.m33 + point.w * this.m43,
      point.x * this.m14 + point.y * this.m24 + point.z * this.m34 + point.w * this.m44,
    )
  }
}
