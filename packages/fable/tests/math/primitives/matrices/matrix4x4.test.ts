import { describe, expect, it } from 'vitest'

import { Matrix3x2, Matrix4x4, Vector2, Vector4 } from '../../../../source/index.js'

describe('Matrix4x4', () => {
  it('creates identity, translation and scale transformations', () => {
    expect(Matrix4x4.identity).toEqual(
      new Matrix4x4(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1),
    )
    expect(Matrix4x4.translation(10, 20, 30)).toEqual(
      new Matrix4x4(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 10, 20, 30, 1),
    )
    expect(Matrix4x4.scaling(2, 3, 4)).toEqual(
      new Matrix4x4(2, 0, 0, 0, 0, 3, 0, 0, 0, 0, 4, 0, 0, 0, 0, 1),
    )
  })

  it('creates rotations around each axis', () => {
    const rotationX = Matrix4x4.rotationX(Math.PI / 2)
    expect(rotationX.m22).toBeCloseTo(0)
    expect(rotationX.m23).toBeCloseTo(1)
    expect(rotationX.m32).toBeCloseTo(-1)
    expect(rotationX.m33).toBeCloseTo(0)

    const rotationY = Matrix4x4.rotationY(Math.PI / 2)
    expect(rotationY.m11).toBeCloseTo(0)
    expect(rotationY.m13).toBeCloseTo(-1)
    expect(rotationY.m31).toBeCloseTo(1)
    expect(rotationY.m33).toBeCloseTo(0)

    const rotationZ = Matrix4x4.rotationZ(Math.PI / 2)
    expect(rotationZ.m11).toBeCloseTo(0)
    expect(rotationZ.m12).toBeCloseTo(1)
    expect(rotationZ.m21).toBeCloseTo(-1)
    expect(rotationZ.m22).toBeCloseTo(0)
  })

  it('transforms points without mutating them', () => {
    const point = new Vector4(1, 2, 3, 1)
    const transformed = Matrix4x4.translation(10, 20, 30).transform(point)

    expect(transformed).toEqual(new Vector4(11, 22, 33, 1))
    expect(point).toEqual(new Vector4(1, 2, 3, 1))
  })

  it('composes transformations by applying this matrix first', () => {
    const rotateThenTranslate = Matrix4x4.rotationZ(Math.PI / 2).multiply(
      Matrix4x4.translation(10, 0, 0),
    )
    const rotated = rotateThenTranslate.transform(new Vector4(0, 1, 0, 1))

    expect(rotated.x).toBeCloseTo(9)
    expect(rotated.y).toBeCloseTo(0)
    expect(rotated.z).toBeCloseTo(0)
    expect(rotated.w).toBe(1)
  })

  it('matches Matrix3x2 for two-dimensional transforms', () => {
    const matrix = Matrix3x2.translation(10, 20).multiply(Matrix3x2.rotation(Math.PI / 2))
    const volume = Matrix4x4.translation(10, 20, 0).multiply(Matrix4x4.rotationZ(Math.PI / 2))

    const point = matrix.transform(new Vector2(1, 0))
    const transformed = volume.transform(new Vector4(1, 0, 0, 1))

    expect(transformed.x).toBeCloseTo(point.x)
    expect(transformed.y).toBeCloseTo(point.y)
  })

  it('creates orthographic projections and promotes two-dimensional matrices', () => {
    const projection = Matrix4x4.orthographicOffCenter(-320, 320, 180, -180, -1, 1)

    expect(projection.m11).toBeCloseTo(2 / 640)
    expect(projection.m22).toBeCloseTo(-2 / 360)
    expect(projection.m33).toBeCloseTo(0.5)
    expect(projection.m41).toBeCloseTo(0)
    expect(projection.m42).toBeCloseTo(0)

    const promoted = Matrix4x4.fromMatrix3x2(Matrix3x2.translation(10, 20))
    const point = promoted.transform(new Vector4(1, 2, 0, 1))
    expect(point).toEqual(new Vector4(11, 22, 0, 1))
  })

  it('inverts invertible matrices and reports singular ones', () => {
    const transform = Matrix4x4.translation(10, 20, 30)
      .multiply(Matrix4x4.rotationZ(Math.PI / 3))
      .multiply(Matrix4x4.scaling(2, 4, 8))
    const inverse = transform.invert()
    expect(inverse).toBeDefined()

    const point = new Vector4(3, 5, 7, 1)
    const roundTrip = inverse?.transform(transform.transform(point))
    expect(roundTrip?.x).toBeCloseTo(point.x)
    expect(roundTrip?.y).toBeCloseTo(point.y)
    expect(roundTrip?.z).toBeCloseTo(point.z)
    expect(roundTrip?.w).toBeCloseTo(point.w)

    expect(Matrix4x4.scaling(0, 1, 1).invert()).toBeUndefined()
  })
})
