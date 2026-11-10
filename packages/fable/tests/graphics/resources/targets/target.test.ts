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

  it('draws four samples per pixel by default', () => {
    const target = new RenderTarget(new Vector2(320, 180))

    expect(target.sampleCount).toBe(4)
    target.destroy()
  })

  it('accepts a custom sample count', () => {
    const target = new RenderTarget(new Vector2(320, 180), { sampleCount: 1 })

    expect(target.sampleCount).toBe(1)
    target.destroy()
  })

  it('rejects sample counts that are not positive integers', () => {
    expect(() => new RenderTarget(new Vector2(10, 10), { sampleCount: 0 })).toThrow(
      'positive integers',
    )
    expect(() => new RenderTarget(new Vector2(10, 10), { sampleCount: 2.5 })).toThrow(
      'positive integers',
    )
  })
})
