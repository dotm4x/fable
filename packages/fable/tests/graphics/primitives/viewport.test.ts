import { describe, expect, it } from 'vitest'

import { Vector2, Viewport } from '../../../source/index.js'

describe('Viewport', () => {
  it('exposes its position and size', () => {
    const position = new Vector2(10, 20)
    const size = new Vector2(1920, 1080)
    const viewport = new Viewport(position, size)

    expect(viewport.position).toBe(position)
    expect(viewport.size).toBe(size)
  })

  it('calculates the aspect ratio and returns zero for zero height', () => {
    expect(new Viewport(new Vector2(0, 0), new Vector2(1920, 1080)).aspectRatio).toBeCloseTo(16 / 9)
    expect(new Viewport(new Vector2(0, 0), new Vector2(4, 0)).aspectRatio).toBe(0)
    expect(new Viewport(new Vector2(0, 0), new Vector2(0, 4)).aspectRatio).toBe(0)
  })

  it('compares position and size by value', () => {
    const viewport = new Viewport(new Vector2(1, 2), new Vector2(3, 4))

    expect(viewport.equals(new Viewport(new Vector2(1, 2), new Vector2(3, 4)))).toBe(true)
    expect(viewport.equals(new Viewport(new Vector2(1, 2), new Vector2(3, 5)))).toBe(false)
    expect(viewport.equals(new Viewport(new Vector2(2, 2), new Vector2(3, 4)))).toBe(false)
  })
})
