import { describe, expect, it } from 'vitest'

import { Matrix3x2, Vector2 } from '../../../../../source/index.js'

describe('Matrix3x2', () => {
  it('creates identity, translation, scale and rotation transformations', () => {
    expect(Matrix3x2.identity).toEqual(new Matrix3x2(1, 0, 0, 1, 0, 0))
    expect(Matrix3x2.translation(10, 20)).toEqual(new Matrix3x2(1, 0, 0, 1, 10, 20))
    expect(Matrix3x2.scaling(2, 3)).toEqual(new Matrix3x2(2, 0, 0, 3, 0, 0))
    const rotation = Matrix3x2.rotation(Math.PI / 2)
    expect(rotation.m11).toBeCloseTo(0)
    expect(rotation.m12).toBeCloseTo(1)
    expect(rotation.m21).toBeCloseTo(-1)
    expect(rotation.m22).toBeCloseTo(0)
    expect(rotation.m31).toBe(0)
    expect(rotation.m32).toBe(0)
  })

  it('transforms points without mutating them', () => {
    const point = new Vector2(1, 2)
    const transformed = Matrix3x2.translation(10, 20).transform(point)

    expect(transformed).toEqual(new Vector2(11, 22))
    expect(point).toEqual(new Vector2(1, 2))
  })

  it('composes transformations by applying this matrix first', () => {
    const translatedThenScaled = Matrix3x2.translation(10, 0).multiply(Matrix3x2.scaling(2, 2))

    expect(translatedThenScaled.transform(new Vector2(1, 1))).toEqual(new Vector2(22, 2))

    const rotated = Matrix3x2.rotation(Math.PI / 2).multiply(Matrix3x2.translation(10, 0))
    const point = rotated.transform(new Vector2(1, 0))

    expect(point.x).toBeCloseTo(10)
    expect(point.y).toBeCloseTo(1)
  })

  it('inverts invertible matrices and reports singular ones', () => {
    const transform = Matrix3x2.translation(10, 20).multiply(Matrix3x2.scaling(2, 4))
    const inverse = transform.invert()
    expect(inverse).toBeDefined()

    const point = new Vector2(3, 5)
    const roundTrip = inverse?.transform(transform.transform(point))
    expect(roundTrip?.x).toBeCloseTo(point.x)
    expect(roundTrip?.y).toBeCloseTo(point.y)
    expect(Matrix3x2.scaling(0, 1).invert()).toBeUndefined()
  })
})
