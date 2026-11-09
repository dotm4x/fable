import { Mesh } from '#/math/geometry/mesh.js'

import { type GraphicVertex2D } from './vertex2d.js'

/**
 * Indexed two-dimensional geometry prepared for graphical rendering.
 *
 * Each vertex contains the attributes required by the standard two-dimensional
 * rendering pipeline: its position, texture coordinate and color. The mesh
 * describes geometry only and never creates textures or GPU resources.
 */
export class GraphicMesh2D extends Mesh<GraphicVertex2D> {
  /**
   * @param vertices - The graphical vertices to copy.
   * @param indices - The triangle indices to copy, or null to use the vertices
   * sequentially in groups of three.
   * @throws {@link Error} If there are no complete triangles, an index refers
   * to a vertex outside the mesh, or a vertex contains nonfinite values.
   */
  public constructor(vertices: Iterable<GraphicVertex2D>, indices?: Iterable<number> | null) {
    super(validateVertices(vertices), indices)
  }
}

function validateVertices(vertices: Iterable<GraphicVertex2D>): GraphicVertex2D[] {
  const validated: GraphicVertex2D[] = []
  let position = 0

  for (const vertex of vertices) {
    if (
      !Number.isFinite(vertex.position.x) ||
      !Number.isFinite(vertex.position.y) ||
      !Number.isFinite(vertex.textureCoordinate.x) ||
      !Number.isFinite(vertex.textureCoordinate.y)
    ) {
      throw new Error(`Vertex ${String(position)} contains nonfinite values.`)
    }
    validated.push(vertex)
    position++
  }

  return validated
}
