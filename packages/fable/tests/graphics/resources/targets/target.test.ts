import { describe, expect, it } from 'vitest'

import { RenderTarget, Vector2 } from '../../../../source/index.js'

describe('RenderTarget', () => {
  it('exposes its size', () => {
    const target = new RenderTarget(new Vector2(320, 180))

    expect(target.size).toEqual(new Vector2(320, 180))
    target.destroy()
    expect(target.destroyed).toBe(true)
  })

  it('rejects dimensions that are not positive integers', () => {
    expect(() => new RenderTarget(new Vector2(0, 10))).toThrow('positive integers')
    expect(() => new RenderTarget(new Vector2(10, 1.5))).toThrow('positive integers')
    expect(() => new RenderTarget(new Vector2(Number.NaN, 10))).toThrow('positive integers')
  })
})
