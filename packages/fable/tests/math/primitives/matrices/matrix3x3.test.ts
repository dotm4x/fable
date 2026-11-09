import { describe, expect, it } from 'vitest'

import { Matrix3x3, Matrix4x4, Vector3, Vector4 } from '../../../../source/index.js'

describe('Matrix3x3', () => {
  it('creates identity and scale transformations', () => {
    expect(Matrix3x3.identity).toEqual(new Matrix3x3(1, 0, 0, 0, 1, 0, 0, 0, 1))
    expect(Matrix3x3.scaling(2, 3, 4)).toEqual(new Matrix3x3(2, 0, 0, 0, 3, 0, 0, 0, 4))
  })

  it('creates rotations around each axis', () => {
    const rotationX = Matrix3x3.rotationX(Math.PI / 2)
    expect(rotationX.m22).toBeCloseTo(0)
    expect(rotationX.m23).toBeCloseTo(1)
    expect(rotationX.m32).toBeCloseTo(-1)
    expect(rotationX.m33).toBeCloseTo(0)

    const rotationY = Matrix3x3.rotationY(Math.PI / 2)
    expect(rotationY.m11).toBeCloseTo(0)
    expect(rotationY.m13).toBeCloseTo(-1)
    expect(rotationY.m31).toBeCloseTo(1)
    expect(rotationY.m33).toBeCloseTo(0)

    const rotationZ = Matrix3x3.rotationZ(Math.PI / 2)
    expect(rotationZ.m11).toBeCloseTo(0)
    expect(rotationZ.m12).toBeCloseTo(1)
    expect(rotationZ.m21).toBeCloseTo(-1)
    expect(rotationZ.m22).toBeCloseTo(0)
  })

  it('transforms vectors without mutating them', () => {
    const vector = new Vector3(1, 2, 3)
    const transformed = Matrix3x3.scaling(2, 3, 4).transform(vector)

    expect(transformed).toEqual(new Vector3(2, 6, 12))
    expect(vector).toEqual(new Vector3(1, 2, 3))
  })

  it('composes transformations by applying this matrix first', () => {
    const rotateThenScale = Matrix3x3.rotationZ(Math.PI / 2).multiply(Matrix3x3.scaling(2, 3, 4))
    const transformed = rotateThenScale.transform(new Vector3(1, 0, 0))

    expect(transformed.x).toBeCloseTo(0)
    expect(transformed.y).toBeCloseTo(3)
    expect(transformed.z).toBeCloseTo(0)
  })

  it('matches the linear part of Matrix4x4', () => {
    const matrix = Matrix3x3.rotationX(Math.PI / 3)
    const affine = Matrix4x4.rotationX(Math.PI / 3)

    const vector = matrix.transform(new Vector3(2, 5, 7))
    const transformed = affine.transform(new Vector4(2, 5, 7, 1))

    expect(vector.x).toBeCloseTo(transformed.x)
    expect(vector.y).toBeCloseTo(transformed.y)
    expect(vector.z).toBeCloseTo(transformed.z)
  })

  it('inverts invertible matrices and reports singular ones', () => {
    const transform = Matrix3x3.rotationZ(Math.PI / 3).multiply(Matrix3x3.scaling(2, 4, 8))
    const inverse = transform.invert()
    expect(inverse).toBeDefined()

    const vector = new Vector3(3, 5, 7)
    const roundTrip = inverse?.transform(transform.transform(vector))
    expect(roundTrip?.x).toBeCloseTo(vector.x)
    expect(roundTrip?.y).toBeCloseTo(vector.y)
    expect(roundTrip?.z).toBeCloseTo(vector.z)
    expect(Matrix3x3.scaling(0, 1, 1).invert()).toBeUndefined()
  })
})
