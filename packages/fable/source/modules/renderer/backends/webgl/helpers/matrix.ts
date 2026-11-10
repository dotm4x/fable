import { type Matrix4x4 } from '#/math/primitives/matrices/matrix4x4.js'

/** Serializes a matrix in column-major order for `uniformMatrix4fv`. */
export function matrixValues(matrix: Matrix4x4): Float32Array {
  return new Float32Array([
    matrix.m11,
    matrix.m12,
    matrix.m13,
    matrix.m14,
    matrix.m21,
    matrix.m22,
    matrix.m23,
    matrix.m24,
    matrix.m31,
    matrix.m32,
    matrix.m33,
    matrix.m34,
    matrix.m41,
    matrix.m42,
    matrix.m43,
    matrix.m44,
  ])
}
