import { describe, expect, it } from 'vitest'

import { type Vector, Vector4 } from '../../../../source/index.js'

describe('Vector4', () => {
  it('supports the shared vector contract', () => {
    const vector: Vector<Vector4> = new Vector4(1, 2, 3, 4)
    const other = new Vector4(4, 5, 6, 7)

    expect(vector.add(other)).toEqual(new Vector4(5, 7, 9, 11))
    expect(vector.dot(other)).toBe(60)
    expect(vector.dimension).toBe(4)
    expect(vector.toArray()).toEqual([1, 2, 3, 4])
  })
})
