import { describe, expect, it } from 'vitest'

import { Bounds2, Vector2 } from '../../../source/index.js'

describe('Bounds2', () => {
  it('exposes size and center', () => {
    const bounds = new Bounds2(new Vector2(0, 10), new Vector2(20, 30))

    expect(bounds.size).toEqual(new Vector2(20, 20))
    expect(bounds.center).toEqual(new Vector2(10, 20))
  })

  it('tests containment and intersection', () => {
    const bounds = new Bounds2(new Vector2(0, 0), new Vector2(10, 10))

    expect(bounds.contains(new Vector2(5, 5))).toBe(true)
    expect(bounds.contains(new Vector2(10, 0))).toBe(true)
    expect(bounds.contains(new Vector2(11, 5))).toBe(false)
    expect(bounds.intersects(new Bounds2(new Vector2(9, 9), new Vector2(20, 20)))).toBe(true)
    expect(bounds.intersects(new Bounds2(new Vector2(11, 0), new Vector2(20, 10)))).toBe(false)
  })

  it('creates bounds from points', () => {
    const bounds = Bounds2.fromPoints([new Vector2(2, 3), new Vector2(-1, 8), new Vector2(4, -2)])

    expect(bounds.min).toEqual(new Vector2(-1, -2))
    expect(bounds.max).toEqual(new Vector2(4, 8))
  })

  it('rejects inverted bounds and empty point sets', () => {
    expect(() => new Bounds2(new Vector2(1, 1), new Vector2(0, 2))).toThrow(
      'must not be below the minimum',
    )
    expect(() => Bounds2.fromPoints([])).toThrow('at least one point')
  })
})
