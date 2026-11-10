import { type Vector2 } from '../primitives/vectors/vector2.js'

import { Mesh } from './mesh.js'

/**
 * Indexed two-dimensional triangle geometry.
 *
 * Vertex positions are expressed in local two-dimensional coordinates. The
 * mesh does not define how the geometry is positioned, rendered or used by
 * other systems.
 */
export class Mesh2D extends Mesh<Vector2> {
  /**
   * @param vertices - The local vertex positions to copy.
   * @param indices - The triangle indices to copy, or null to use the vertices
   * sequentially in groups of three.
   * @throws {@link Error} If a vertex contains nonfinite coordinates, there
   * are no complete triangles, or an index refers to a vertex outside the mesh.
   */
  public constructor(vertices: Iterable<Vector2>, indices?: Iterable<number> | null) {
    super(validateVertices(vertices), indices)
  }
}

function validateVertices(vertices: Iterable<Vector2>): Vector2[] {
  const validated: Vector2[] = []
  let position = 0

  for (const vertex of vertices) {
    if (!Number.isFinite(vertex.x) || !Number.isFinite(vertex.y)) {
      throw new Error(`Vertex ${String(position)} contains nonfinite coordinates.`)
    }

    validated.push(vertex)
    position++
  }

  return validated
}
