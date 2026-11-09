/**
 * Indexed triangle geometry composed of vertices of a specific type.
 *
 * Derived mesh types define the representation and validation requirements of
 * their vertices. Vertices and indices are copied when the mesh is created,
 * and the copies are frozen.
 *
 * @typeParam TVertex - The type used to represent each vertex.
 */
export abstract class Mesh<TVertex> {
  /** Vertex indices ordered in groups of three. */
  public readonly indices: readonly number[]

  /** Vertices that compose the mesh. */
  public readonly vertices: readonly TVertex[]

  /**
   * @param vertices - The vertices to copy.
   * @param indices - The triangle indices to copy, or null to use the vertices
   * sequentially in groups of three.
   * @throws {@link Error} If there are no complete triangles, an index is not
   * an integer, or an index refers to a vertex outside the mesh.
   */
  protected constructor(vertices: Iterable<TVertex>, indices?: Iterable<number> | null) {
    const vertexList = Object.freeze([...vertices])
    const indexList = Object.freeze(
      indices === undefined || indices === null
        ? sequentialIndices(vertexList.length)
        : [...indices],
    )

    if (indexList.length === 0 || indexList.length % 3 !== 0) {
      throw new Error('A mesh must contain at least one complete triangle.')
    }
    for (const [position, index] of indexList.entries()) {
      if (!Number.isInteger(index)) {
        throw new Error(`Index ${String(position)} must be an integer.`)
      }
      if (index < 0 || index >= vertexList.length) {
        throw new Error(`Index ${String(position)} refers to a vertex outside the mesh.`)
      }
    }

    this.vertices = vertexList
    this.indices = indexList
  }

  /** The number of triangles in the mesh. */
  public get triangleCount(): number {
    return this.indices.length / 3
  }
}

function sequentialIndices(length: number): number[] {
  const indices: number[] = []
  for (let index = 0; index < length; index++) {
    indices.push(index)
  }

  return indices
}
