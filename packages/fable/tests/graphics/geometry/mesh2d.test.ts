import { describe, expect, it } from 'vitest'

import { Color, GraphicMesh2D, GraphicVertex2D, Mesh, Vector2 } from '../../../source/index.js'

function vertex(x: number, y: number): GraphicVertex2D {
  return new GraphicVertex2D(new Vector2(x, y), new Vector2(0, 0), Color.white)
}

describe('GraphicMesh2D', () => {
  it('stores graphical vertices and derives sequential indices', () => {
    const vertices = [vertex(0, 0), vertex(1, 0), vertex(0, 1)]
    const mesh = new GraphicMesh2D(vertices)

    expect(mesh).toBeInstanceOf(Mesh)
    expect(mesh.vertices).toEqual(vertices)
    expect(mesh.indices).toEqual([0, 1, 2])
    expect(mesh.triangleCount).toBe(1)
  })

  it('accepts explicit indices', () => {
    const vertices = [vertex(0, 0), vertex(1, 0), vertex(1, 1), vertex(0, 1)]
    const mesh = new GraphicMesh2D(vertices, [0, 1, 2, 0, 2, 3])

    expect(mesh.triangleCount).toBe(2)
    expect(mesh.indices).toEqual([0, 1, 2, 0, 2, 3])
  })

  it('rejects vertices with nonfinite positions or texture coordinates', () => {
    const nonfinitePosition = new GraphicVertex2D(
      new Vector2(Number.NaN, 0),
      new Vector2(0, 0),
      Color.white,
    )
    expect(() => new GraphicMesh2D([vertex(0, 0), nonfinitePosition, vertex(0, 1)])).toThrow(
      'Vertex 1 contains nonfinite values.',
    )

    const nonfiniteCoordinate = new GraphicVertex2D(
      new Vector2(0, 0),
      new Vector2(0, Number.POSITIVE_INFINITY),
      Color.white,
    )
    expect(() => new GraphicMesh2D([vertex(0, 0), vertex(1, 0), nonfiniteCoordinate])).toThrow(
      'Vertex 2 contains nonfinite values.',
    )
  })

  it('rejects incomplete triangles and invalid indices', () => {
    expect(() => new GraphicMesh2D([vertex(0, 0), vertex(1, 0)], [0, 1])).toThrow(
      'at least one complete triangle',
    )
    expect(() => new GraphicMesh2D([vertex(0, 0), vertex(1, 0), vertex(0, 1)], [0, 1, 3])).toThrow(
      'refers to a vertex outside the mesh',
    )
  })
})
