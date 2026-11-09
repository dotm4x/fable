import { describe, expect, it } from 'vitest'

import { Color, GraphicVertex2D, Vector2 } from '../../../source/index.js'

describe('GraphicVertex2D', () => {
  it('exposes its position, texture coordinate and color', () => {
    const position = new Vector2(1, 2)
    const textureCoordinate = new Vector2(0.5, 0.25)
    const color = Color.white
    const vertex = new GraphicVertex2D(position, textureCoordinate, color)

    expect(vertex.position).toBe(position)
    expect(vertex.textureCoordinate).toBe(textureCoordinate)
    expect(vertex.color).toBe(color)
  })

  it('compares all attributes by value', () => {
    const vertex = new GraphicVertex2D(new Vector2(1, 2), new Vector2(0.5, 0.5), Color.white)

    expect(
      vertex.equals(new GraphicVertex2D(new Vector2(1, 2), new Vector2(0.5, 0.5), Color.white)),
    ).toBe(true)
    expect(
      vertex.equals(new GraphicVertex2D(new Vector2(1, 3), new Vector2(0.5, 0.5), Color.white)),
    ).toBe(false)
    expect(
      vertex.equals(new GraphicVertex2D(new Vector2(1, 2), new Vector2(0.5, 0.25), Color.white)),
    ).toBe(false)
    expect(
      vertex.equals(new GraphicVertex2D(new Vector2(1, 2), new Vector2(0.5, 0.5), Color.black)),
    ).toBe(false)
  })
})
