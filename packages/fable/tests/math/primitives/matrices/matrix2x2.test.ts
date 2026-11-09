import { describe, expect, it } from 'vitest'

import { Matrix2x2, Matrix3x2, Vector2 } from '../../../../source/index.js'

describe('Matrix2x2', () => {
  it('creates identity, scale and rotation transformations', () => {
    expect(Matrix2x2.identity).toEqual(new Matrix2x2(1, 0, 0, 1))
    expect(Matrix2x2.scaling(2, 3)).toEqual(new Matrix2x2(2, 0, 0, 3))

    const rotation = Matrix2x2.rotation(Math.PI / 2)
    expect(rotation.m11).toBeCloseTo(0)
    expect(rotation.m12).toBeCloseTo(1)
    expect(rotation.m21).toBeCloseTo(-1)
    expect(rotation.m22).toBeCloseTo(0)
  })

  it('transforms vectors without mutating them', () => {
    const vector = new Vector2(1, 2)
    const transformed = Matrix2x2.scaling(2, 3).transform(vector)

    expect(transformed).toEqual(new Vector2(2, 6))
    expect(vector).toEqual(new Vector2(1, 2))
  })

  it('composes transformations by applying this matrix first', () => {
    const rotateThenScale = Matrix2x2.rotation(Math.PI / 2).multiply(Matrix2x2.scaling(2, 3))
    const transformed = rotateThenScale.transform(new Vector2(1, 0))

    expect(transformed.x).toBeCloseTo(0)
    expect(transformed.y).toBeCloseTo(3)
  })

  it('matches the linear part of Matrix3x2', () => {
    const matrix = Matrix2x2.rotation(Math.PI / 3)
    const affine = Matrix3x2.rotation(Math.PI / 3)

    const vector = matrix.transform(new Vector2(2, 5))
    const transform = affine.transform(new Vector2(2, 5))

    expect(vector.x).toBeCloseTo(transform.x)
    expect(vector.y).toBeCloseTo(transform.y)
  })

  it('inverts invertible matrices and reports singular ones', () => {
    const transform = Matrix2x2.rotation(Math.PI / 3).multiply(Matrix2x2.scaling(2, 4))
    const inverse = transform.invert()
    expect(inverse).toBeDefined()

    const vector = new Vector2(3, 5)
    const roundTrip = inverse?.transform(transform.transform(vector))
    expect(roundTrip?.x).toBeCloseTo(vector.x)
    expect(roundTrip?.y).toBeCloseTo(vector.y)
    expect(Matrix2x2.scaling(0, 1).invert()).toBeUndefined()
  })
})
