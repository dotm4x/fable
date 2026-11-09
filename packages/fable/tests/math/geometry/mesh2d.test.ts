import { describe, expect, it } from 'vitest'

import { Mesh, Mesh2D, Vector2 } from '../../../source/index.js'

describe('Mesh2D', () => {
  it('stores local positions and derives sequential indices', () => {
    const vertices = [new Vector2(0, 0), new Vector2(1, 0), new Vector2(0, 1)]
    const mesh = new Mesh2D(vertices)

    expect(mesh).toBeInstanceOf(Mesh)
    expect(mesh.vertices).toEqual(vertices)
    expect(mesh.vertices[0]).toBe(vertices[0])
    expect(mesh.indices).toEqual([0, 1, 2])
    expect(mesh.triangleCount).toBe(1)
  })

  it('accepts explicit indices', () => {
    const vertices = [new Vector2(0, 0), new Vector2(1, 0), new Vector2(1, 1), new Vector2(0, 1)]
    const mesh = new Mesh2D(vertices, [0, 1, 2, 0, 2, 3])

    expect(mesh.triangleCount).toBe(2)
    expect(mesh.indices).toEqual([0, 1, 2, 0, 2, 3])
  })

  it('rejects vertices with nonfinite coordinates', () => {
    const coordinates = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]

    for (const coordinate of coordinates) {
      expect(
        () => new Mesh2D([new Vector2(0, 0), new Vector2(coordinate, 0), new Vector2(0, 1)]),
      ).toThrow('Vertex 1 contains nonfinite coordinates.')
      expect(
        () => new Mesh2D([new Vector2(0, coordinate), new Vector2(1, 0), new Vector2(0, 1)]),
      ).toThrow('Vertex 0 contains nonfinite coordinates.')
    }
  })

  it('rejects incomplete triangles and invalid indices', () => {
    const vertices = [new Vector2(0, 0), new Vector2(1, 0), new Vector2(0, 1)]

    expect(() => new Mesh2D(vertices, [0, 1])).toThrow('at least one complete triangle')
    expect(() => new Mesh2D(vertices, [0, 1, 3])).toThrow('refers to a vertex outside the mesh')
  })
})
