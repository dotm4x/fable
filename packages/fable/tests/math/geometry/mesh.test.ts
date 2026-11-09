import { describe, expect, it } from 'vitest'

import { Mesh } from '../../../source/index.js'

class TestMesh extends Mesh<number> {
  public constructor(vertices: Iterable<number>, indices?: Iterable<number> | null) {
    super(vertices, indices)
  }
}

describe('Mesh', () => {
  it('derives sequential indices when none are given', () => {
    const mesh = new TestMesh([10, 20, 30, 40, 50, 60])

    expect(mesh.vertices).toEqual([10, 20, 30, 40, 50, 60])
    expect(mesh.indices).toEqual([0, 1, 2, 3, 4, 5])
    expect(mesh.triangleCount).toBe(2)
  })

  it('copies and freezes vertices and indices', () => {
    const vertices = [0, 1, 2, 3, 4, 5]
    const indices = [5, 4, 3, 2, 1, 0]
    const mesh = new TestMesh(vertices, indices)

    vertices[0] = 99
    indices[0] = 99

    expect(mesh.vertices).toEqual([0, 1, 2, 3, 4, 5])
    expect(mesh.indices).toEqual([5, 4, 3, 2, 1, 0])
    expect(Object.isFrozen(mesh.vertices)).toBe(true)
    expect(Object.isFrozen(mesh.indices)).toBe(true)
  })

  it('rejects meshes without complete triangles', () => {
    expect(() => new TestMesh([])).toThrow('at least one complete triangle')
    expect(() => new TestMesh([0, 1, 2], [])).toThrow('at least one complete triangle')
    expect(() => new TestMesh([0, 1, 2, 3], [0, 1, 2, 3])).toThrow('at least one complete triangle')
  })

  it('rejects indices outside the mesh or that are not integers', () => {
    expect(() => new TestMesh([0, 1, 2], [0, 1, 3])).toThrow(
      'Index 2 refers to a vertex outside the mesh.',
    )
    expect(() => new TestMesh([0, 1, 2], [-1, 1, 2])).toThrow('refers to a vertex outside')
    expect(() => new TestMesh([0, 1, 2], [0, 1.5, 2])).toThrow('Index 1 must be an integer.')
  })
})
