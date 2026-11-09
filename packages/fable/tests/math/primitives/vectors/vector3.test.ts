import { describe, expect, it } from 'vitest'

import { type Vector, Vector3 } from '../../../../source/index.js'

describe('Vector3', () => {
  it('supports the shared vector contract', () => {
    const vector: Vector<Vector3> = new Vector3(1, 2, 3)
    const other = new Vector3(4, 5, 6)

    expect(vector.add(other)).toEqual(new Vector3(5, 7, 9))
    expect(vector.dot(other)).toBe(32)
    expect(vector.dimension).toBe(3)
    expect(vector.toArray()).toEqual([1, 2, 3])
  })

  it('normalizes a zero vector without producing non-finite components', () => {
    expect(new Vector3(0, 0, 0).normalize()).toEqual(new Vector3(0, 0, 0))
  })
})
