import { type GraphicMesh2D } from '#/graphics/geometry/mesh2d.js'

import { required } from '../helpers/index.js'

const floatsPerVertex = 8
const bytesPerVertex = floatsPerVertex * 4

export interface GlMesh {
  readonly vertexArray: WebGLVertexArrayObject
  readonly vertexBuffer: WebGLBuffer
  readonly indexBuffer: WebGLBuffer
  readonly indexCount: number
}

export class GlMeshes {
  private readonly _gl: WebGL2RenderingContext
  private readonly _meshes: Map<GraphicMesh2D, GlMesh> = new Map<GraphicMesh2D, GlMesh>()

  public constructor(gl: WebGL2RenderingContext) {
    this._gl = gl
  }

  /** Returns the uploaded mesh, uploading it on first use. */
  public get(mesh: GraphicMesh2D): GlMesh {
    const cached = this._meshes.get(mesh)
    if (cached !== undefined) return cached

    const gl = this._gl
    const vertices = new Float32Array(mesh.vertices.length * floatsPerVertex)
    mesh.vertices.forEach((vertex, index) => {
      const offset = index * floatsPerVertex
      vertices[offset] = vertex.position.x
      vertices[offset + 1] = vertex.position.y
      vertices[offset + 2] = vertex.textureCoordinate.x
      vertices[offset + 3] = vertex.textureCoordinate.y
      vertices[offset + 4] = vertex.color.r
      vertices[offset + 5] = vertex.color.g
      vertices[offset + 6] = vertex.color.b
      vertices[offset + 7] = vertex.color.a
    })
    const indices = new Uint32Array(mesh.indices)
    const vertexBuffer = required(gl.createBuffer(), 'Unable to create a vertex buffer.')
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW)
    const indexBuffer = required(gl.createBuffer(), 'Unable to create an index buffer.')
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW)

    const vertexArray = required(gl.createVertexArray(), 'Unable to create a vertex array.')
    gl.bindVertexArray(vertexArray)
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer)
    this.configureAttributes(gl)
    gl.bindVertexArray(null)

    const glMesh: GlMesh = { vertexArray, vertexBuffer, indexBuffer, indexCount: indices.length }
    this._meshes.set(mesh, glMesh)

    return glMesh
  }

  /** Deletes every uploaded mesh. */
  public clear(): void {
    const gl = this._gl
    for (const mesh of this._meshes.values()) {
      gl.deleteVertexArray(mesh.vertexArray)
      gl.deleteBuffer(mesh.vertexBuffer)
      gl.deleteBuffer(mesh.indexBuffer)
    }

    this._meshes.clear()
  }

  private configureAttributes(gl: WebGL2RenderingContext): void {
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, bytesPerVertex, 0)
    gl.enableVertexAttribArray(1)
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, bytesPerVertex, 8)
    gl.enableVertexAttribArray(2)
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, bytesPerVertex, 16)
  }
}
