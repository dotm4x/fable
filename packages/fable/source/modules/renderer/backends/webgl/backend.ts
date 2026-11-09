import { type EventConnection } from '#/core/events/event.js'
import { type Resource } from '#/core/primitives/resource.js'
import { ClearCommand } from '#/graphics/commands/clear.js'
import { type DrawCommand } from '#/graphics/commands/command.js'
import { Draw2DCommand } from '#/graphics/commands/draw2d.js'
import { type GraphicMesh2D } from '#/graphics/geometry/mesh2d.js'
import { type DrawContext } from '#/graphics/interfaces/context.js'
import { type Color } from '#/graphics/primitives/color.js'
import { Viewport } from '#/graphics/primitives/viewport.js'
import { BlendMode } from '#/graphics/resources/blend-mode.js'
import { RasterImageFormat } from '#/graphics/resources/image.js'
import { type GraphicMaterial } from '#/graphics/resources/material.js'
import { ShaderLanguage } from '#/graphics/resources/shader.js'
import { RenderTarget } from '#/graphics/resources/targets/target.js'
import { TextureAddressMode } from '#/graphics/resources/textures/address-mode.js'
import { type TextureBinding } from '#/graphics/resources/textures/binding.js'
import { TextureFilter } from '#/graphics/resources/textures/filter.js'
import { ImageTexture } from '#/graphics/resources/textures/image.js'
import type { TextureSampler } from '#/graphics/resources/textures/sampler.js'
import { Matrix4x4 } from '#/math/primitives/matrices/matrix4x4.js'
import { Vector2 } from '#/math/primitives/vectors/vector2.js'

import { RenderBackend } from '../backend.js'

import { createDraw2DMaterial } from './shaders/draw2d.js'

const floatsPerVertex = 8
const bytesPerVertex = floatsPerVertex * 4
const maxTextures = 4

interface GlProgram {
  readonly program: WebGLProgram
  readonly transform: WebGLUniformLocation
  readonly viewProjection: WebGLUniformLocation
  readonly textures: WebGLUniformLocation
}

interface GlMesh {
  readonly vertexArray: WebGLVertexArrayObject
  readonly vertexBuffer: WebGLBuffer
  readonly indexBuffer: WebGLBuffer
  readonly indexCount: number
}

interface GlTarget {
  readonly framebuffer: WebGLFramebuffer
  readonly texture: WebGLTexture
}

/** Configuration for a WebGL backend. */
export interface WebGlBackendOptions {
  /** Canvas borrowed as the drawing surface. */
  readonly canvas: HTMLCanvasElement
  /** Backend identifier. Defaults to `webgl`. */
  readonly identifier?: string
  /** Whether the drawing surface is antialiased. Defaults to true. */
  readonly antialias?: boolean
}

/**
 * Draws two-dimensional geometry with WebGL 2.
 *
 * Programs are compiled per material, meshes are uploaded once into vertex
 * arrays and textures are uploaded per binding. Materials must use GLSL sources
 * and declare the standard uniform names, and support at most one texture
 * binding. Offscreen targets are rendered through cached framebuffers.
 */
export class WebGlBackend extends RenderBackend {
  private readonly _canvas: HTMLCanvasElement
  private readonly _gl: WebGL2RenderingContext
  private readonly _programs: Map<GraphicMaterial, GlProgram> = new Map<
    GraphicMaterial,
    GlProgram
  >()
  private readonly _meshes: Map<GraphicMesh2D, GlMesh> = new Map<GraphicMesh2D, GlMesh>()
  private readonly _textures: Map<TextureBinding, WebGLTexture> = new Map<
    TextureBinding,
    WebGLTexture
  >()
  private readonly _targets: Map<RenderTarget, GlTarget> = new Map<RenderTarget, GlTarget>()
  private readonly _tracked: Map<Resource, EventConnection> = new Map<Resource, EventConnection>()
  private readonly _onContextLost: (event: Event) => void
  private readonly _onContextRestored: () => void
  private _whiteTexture: WebGLTexture | undefined
  private _contextLost: boolean = false
  private _batchVertexArray: WebGLVertexArrayObject | undefined
  private _batchVertexBuffer: WebGLBuffer | undefined
  private _batchIndexBuffer: WebGLBuffer | undefined
  private _batchVertices: Float32Array = new Float32Array(0)
  private _batchIndices: Uint32Array = new Uint32Array(0)
  private _batchVertexCapacity: number = 0
  private _batchIndexCapacity: number = 0

  /** @inheritDoc */
  public readonly defaultMaterial: GraphicMaterial

  /**
   * @param options - Canvas to borrow and optional identifier.
   * @throws {@link Error} If a WebGL 2 context is unavailable.
   */
  public constructor({ canvas, identifier = 'webgl', antialias = true }: WebGlBackendOptions) {
    super(identifier)
    const gl = canvas.getContext('webgl2', { antialias })
    if (gl === null) {
      throw new Error('A WebGL 2 context is unavailable.')
    }

    this._canvas = canvas
    this._gl = gl
    this.defaultMaterial = this.createMaterial()
    this._onContextLost = (event: Event): void => {
      event.preventDefault()
      this._contextLost = true
    }
    this._onContextRestored = (): void => {
      this._programs.clear()
      this._meshes.clear()
      this._textures.clear()
      this._targets.clear()
      this._tracked.clear()
      this._whiteTexture = undefined
      this.resetBatchBuffers()
      this._contextLost = false
    }
    canvas.addEventListener('webglcontextlost', this._onContextLost)
    canvas.addEventListener('webglcontextrestored', this._onContextRestored)
  }

  /** @inheritDoc */
  public createMaterial(textures?: Iterable<TextureBinding>): GraphicMaterial {
    return createDraw2DMaterial(textures)
  }

  /** @inheritDoc */
  public get viewport(): Viewport {
    return new Viewport(new Vector2(0, 0), new Vector2(this._canvas.width, this._canvas.height))
  }

  protected override onBeginFrame(): void {
    if (this._contextLost) {
      throw new Error('The WebGL context was lost.')
    }
    this.syncCanvasSize()
  }

  protected override onEndFrame(): void {
    // WebGL draws immediately; nothing is submitted at the end of a frame.
  }

  protected override onRender(
    commands: readonly DrawCommand[],
    context: DrawContext | undefined,
    target: RenderTarget | undefined,
  ): void {
    const gl = this._gl
    const size = target === undefined ? this.backbufferSize : target.size
    gl.bindFramebuffer(
      gl.FRAMEBUFFER,
      target === undefined ? null : this.glTarget(target).framebuffer,
    )
    gl.viewport(0, 0, size.x, size.y)

    let batch: Draw2DCommand[] = []
    const flush = (): void => {
      if (batch.length === 0) return
      if (context === undefined) throw new Error('Drawing commands require a drawing context.')
      this.drawBatch(batch, context)
      batch = []
    }

    try {
      for (const command of commands) {
        if (command instanceof ClearCommand) {
          flush()
          this.clear(command.color)
        } else if (command instanceof Draw2DCommand) {
          if (context === undefined) throw new Error('Drawing commands require a drawing context.')
          const previous = batch[batch.length - 1]
          if (previous !== undefined && previous.material !== command.material) flush()
          batch.push(command)
        }
      }
      flush()
    } finally {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.bindVertexArray(null)
    }
  }

  protected override onDestroy(): void {
    this._canvas.removeEventListener('webglcontextlost', this._onContextLost)
    this._canvas.removeEventListener('webglcontextrestored', this._onContextRestored)
    if (!this._contextLost) {
      const gl = this._gl
      for (const program of this._programs.values()) gl.deleteProgram(program.program)
      for (const mesh of this._meshes.values()) {
        gl.deleteVertexArray(mesh.vertexArray)
        gl.deleteBuffer(mesh.vertexBuffer)
        gl.deleteBuffer(mesh.indexBuffer)
      }
      for (const texture of this._textures.values()) gl.deleteTexture(texture)
      for (const target of this._targets.values()) {
        gl.deleteFramebuffer(target.framebuffer)
        gl.deleteTexture(target.texture)
      }
      if (this._whiteTexture !== undefined) gl.deleteTexture(this._whiteTexture)
    }
    for (const connection of this._tracked.values()) connection.destroy()
    this._tracked.clear()
    this._programs.clear()
    this._meshes.clear()
    this._textures.clear()
    this._targets.clear()
    this._whiteTexture = undefined
    if (!this._contextLost) this.deleteBatchBuffers()
    if (!this.defaultMaterial.destroyed) this.defaultMaterial.destroy()
  }

  private get backbufferSize(): Vector2 {
    return new Vector2(this._canvas.width, this._canvas.height)
  }

  private clear(color: Color): void {
    const gl = this._gl
    gl.clearColor(color.r, color.g, color.b, color.a)
    gl.clear(gl.COLOR_BUFFER_BIT)
  }

  private draw(command: Draw2DCommand, context: DrawContext): void {
    const gl = this._gl
    const mesh = this.mesh(command.mesh)
    const viewProjection = context.camera
      .getProjection(context.viewport)
      .multiply(context.camera.view)
    this.applyMaterial(
      command.material,
      matrixValues(viewProjection),
      matrixValues(Matrix4x4.fromMatrix3x2(command.transform)),
    )
    gl.bindVertexArray(mesh.vertexArray)
    gl.drawElements(gl.TRIANGLES, mesh.indexCount, gl.UNSIGNED_INT, 0)
  }

  private drawBatch(batch: readonly Draw2DCommand[], context: DrawContext): void {
    const first = batch[0]
    if (first === undefined) return
    if (batch.length === 1) {
      this.draw(first, context)

      return
    }

    let vertexCount = 0
    let indexCount = 0
    for (const command of batch) {
      vertexCount += command.mesh.vertices.length
      indexCount += command.mesh.indices.length
    }
    this.ensureBatchBuffers(vertexCount, indexCount)

    let vertex = 0
    let index = 0
    for (const command of batch) {
      const base = vertex
      const matrix = command.transform
      for (const item of command.mesh.vertices) {
        const offset = vertex * floatsPerVertex
        const x = item.position.x
        const y = item.position.y
        this._batchVertices[offset] = x * matrix.m11 + y * matrix.m21 + matrix.m31
        this._batchVertices[offset + 1] = x * matrix.m12 + y * matrix.m22 + matrix.m32
        this._batchVertices[offset + 2] = item.textureCoordinate.x
        this._batchVertices[offset + 3] = item.textureCoordinate.y
        this._batchVertices[offset + 4] = item.color.r
        this._batchVertices[offset + 5] = item.color.g
        this._batchVertices[offset + 6] = item.color.b
        this._batchVertices[offset + 7] = item.color.a
        vertex++
      }
      for (const item of command.mesh.indices) {
        this._batchIndices[index] = item + base
        index++
      }
    }

    const gl = this._gl
    gl.bindBuffer(gl.ARRAY_BUFFER, this._batchVertexBuffer ?? null)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      this._batchVertices.subarray(0, vertexCount * floatsPerVertex),
      gl.DYNAMIC_DRAW,
    )
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._batchIndexBuffer ?? null)
    gl.bufferData(
      gl.ELEMENT_ARRAY_BUFFER,
      this._batchIndices.subarray(0, indexCount),
      gl.DYNAMIC_DRAW,
    )

    const viewProjection = context.camera
      .getProjection(context.viewport)
      .multiply(context.camera.view)
    this.applyMaterial(
      first.material,
      matrixValues(viewProjection),
      matrixValues(Matrix4x4.identity),
    )
    gl.bindVertexArray(this._batchVertexArray ?? null)
    gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_INT, 0)
  }

  private applyMaterial(
    material: GraphicMaterial,
    viewProjection: Float32Array,
    transform: Float32Array,
  ): void {
    const gl = this._gl
    const program = this.program(material)
    gl.useProgram(program.program)
    gl.uniformMatrix4fv(program.viewProjection, false, viewProjection)
    gl.uniformMatrix4fv(program.transform, false, transform)
    for (let index = 0; index < maxTextures; index++) {
      const textureBinding = material.textures[index]
      gl.activeTexture(gl.TEXTURE0 + index)
      gl.bindTexture(
        gl.TEXTURE_2D,
        textureBinding === undefined ? this.whiteTexture : this.bindingTexture(textureBinding),
      )
    }
    gl.uniform1iv(program.textures, [0, 1, 2, 3])
    this.applyBlend(material.blend)
  }

  private ensureBatchBuffers(vertices: number, indices: number): void {
    if (
      this._batchVertexArray !== undefined &&
      vertices <= this._batchVertexCapacity &&
      indices <= this._batchIndexCapacity
    ) {
      return
    }

    const gl = this._gl
    this._batchVertexArray ??= required(gl.createVertexArray(), 'Unable to create a vertex array.')
    if (this._batchVertexBuffer !== undefined) gl.deleteBuffer(this._batchVertexBuffer)
    if (this._batchIndexBuffer !== undefined) gl.deleteBuffer(this._batchIndexBuffer)

    this._batchVertexCapacity = Math.max(vertices, this._batchVertexCapacity * 2, 1024)
    this._batchIndexCapacity = Math.max(indices, this._batchIndexCapacity * 2, 1536)
    this._batchVertices = new Float32Array(this._batchVertexCapacity * floatsPerVertex)
    this._batchIndices = new Uint32Array(this._batchIndexCapacity)
    const vertexBuffer = required(gl.createBuffer(), 'Unable to create a vertex buffer.')
    const indexBuffer = required(gl.createBuffer(), 'Unable to create an index buffer.')
    this._batchVertexBuffer = vertexBuffer
    this._batchIndexBuffer = indexBuffer

    gl.bindVertexArray(this._batchVertexArray)
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, bytesPerVertex, 0)
    gl.enableVertexAttribArray(1)
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, bytesPerVertex, 8)
    gl.enableVertexAttribArray(2)
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, bytesPerVertex, 16)
    gl.bindVertexArray(null)
  }

  private resetBatchBuffers(): void {
    this._batchVertexArray = undefined
    this._batchVertexBuffer = undefined
    this._batchIndexBuffer = undefined
    this._batchVertices = new Float32Array(0)
    this._batchIndices = new Uint32Array(0)
    this._batchVertexCapacity = 0
    this._batchIndexCapacity = 0
  }

  private deleteBatchBuffers(): void {
    const gl = this._gl
    if (this._batchVertexArray !== undefined) gl.deleteVertexArray(this._batchVertexArray)
    if (this._batchVertexBuffer !== undefined) gl.deleteBuffer(this._batchVertexBuffer)
    if (this._batchIndexBuffer !== undefined) gl.deleteBuffer(this._batchIndexBuffer)
    this.resetBatchBuffers()
  }

  private bindingTexture(binding: TextureBinding | undefined): WebGLTexture {
    if (binding === undefined) return this.whiteTexture
    if (binding.texture.destroyed) {
      throw new Error('The texture is destroyed.')
    }
    if (binding.texture instanceof RenderTarget) {
      const target = this.glTarget(binding.texture)
      this.applySampler(binding.sampler, false)

      return target.texture
    }
    if (!(binding.texture instanceof ImageTexture)) {
      throw new Error('The WebGL backend only supports image and render target textures.')
    }

    const cached = this._textures.get(binding)
    if (cached !== undefined) return cached
    this.track(binding.texture, () => {
      this.invalidateTextures()
    })
    this.track(binding.texture.image, () => {
      this.invalidateTextures()
    })

    const gl = this._gl
    const image = binding.texture.image
    const texture = required(gl.createTexture(), 'Unable to create a texture.')
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      image.format === RasterImageFormat.rgba8Srgb ? gl.SRGB8_ALPHA8 : gl.RGBA,
      image.width,
      image.height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      image.data,
    )
    this.applySampler(binding.sampler, binding.sampler.mipmaps)
    if (binding.sampler.mipmaps) gl.generateMipmap(gl.TEXTURE_2D)
    this._textures.set(binding, texture)

    return texture
  }

  private track(resource: Resource, invalidate: () => void): void {
    if (resource.destroyed || this._tracked.has(resource)) return
    const connection = resource.onDestroyed.connect(() => {
      invalidate()
      this._tracked.delete(resource)
    })
    this._tracked.set(resource, connection)
  }

  private invalidatePrograms(): void {
    if (this._contextLost) return
    for (const program of this._programs.values()) this._gl.deleteProgram(program.program)
    this._programs.clear()
  }

  private invalidateTextures(): void {
    if (this._contextLost) return
    for (const texture of this._textures.values()) this._gl.deleteTexture(texture)
    this._textures.clear()
  }

  private invalidateTargets(): void {
    if (this._contextLost) return
    for (const target of this._targets.values()) {
      this._gl.deleteFramebuffer(target.framebuffer)
      this._gl.deleteTexture(target.texture)
    }
    this._targets.clear()
  }

  private applyBlend(blend: BlendMode): void {
    const gl = this._gl
    switch (blend) {
      case BlendMode.opaque:
        gl.disable(gl.BLEND)
        return
      case BlendMode.alpha:
        gl.enable(gl.BLEND)
        gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
        return
      case BlendMode.additive:
        gl.enable(gl.BLEND)
        gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE, gl.ONE, gl.ONE)
        return
      case BlendMode.multiply:
        gl.enable(gl.BLEND)
        gl.blendFuncSeparate(gl.DST_COLOR, gl.ZERO, gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
        return
      default:
        throw new Error('Unsupported blend mode.')
    }
  }

  private syncCanvasSize(): void {
    const ratio = globalThis.devicePixelRatio
    const cssWidth = this._canvas.clientWidth || this._canvas.width
    const cssHeight = this._canvas.clientHeight || this._canvas.height
    const width = Math.max(1, Math.round(cssWidth * ratio))
    const height = Math.max(1, Math.round(cssHeight * ratio))
    if (this._canvas.width !== width || this._canvas.height !== height) {
      this._canvas.width = width
      this._canvas.height = height
    }
  }

  private applySampler(sampler: TextureSampler, mipmapped: boolean): void {
    const gl = this._gl
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapMode(gl, sampler.addressU))
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapMode(gl, sampler.addressV))
    let minFilter = filterMode(gl, sampler.minFilter)
    if (mipmapped) {
      minFilter =
        sampler.minFilter === TextureFilter.nearest
          ? gl.NEAREST_MIPMAP_LINEAR
          : gl.LINEAR_MIPMAP_LINEAR
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minFilter)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filterMode(gl, sampler.magFilter))
  }

  private get whiteTexture(): WebGLTexture {
    if (this._whiteTexture !== undefined) return this._whiteTexture

    const gl = this._gl
    const texture = required(gl.createTexture(), 'Unable to create a texture.')
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([255, 255, 255, 255]),
    )
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    this._whiteTexture = texture

    return texture
  }

  private glTarget(target: RenderTarget): GlTarget {
    const cached = this._targets.get(target)
    if (cached !== undefined) return cached
    this.track(target, () => {
      this.invalidateTargets()
    })

    const gl = this._gl
    const size = target.size
    const texture = required(gl.createTexture(), 'Unable to create a target texture.')
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size.x, size.y, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

    const framebuffer = required(gl.createFramebuffer(), 'Unable to create a framebuffer.')
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      gl.deleteFramebuffer(framebuffer)
      gl.deleteTexture(texture)
      throw new Error('The render target framebuffer is incomplete.')
    }

    const glTarget: GlTarget = { framebuffer, texture }
    this._targets.set(target, glTarget)

    return glTarget
  }

  private program(material: GraphicMaterial): GlProgram {
    if (material.destroyed) {
      throw new Error('The material is destroyed.')
    }
    const cached = this._programs.get(material)
    if (cached !== undefined) return cached
    this.track(material, () => {
      this.invalidatePrograms()
    })
    if (
      material.vertexShader.language !== ShaderLanguage.glsl ||
      material.fragmentShader.language !== ShaderLanguage.glsl
    ) {
      throw new Error('The WebGL backend requires GLSL shader sources.')
    }
    if (material.textures.length > maxTextures) {
      throw new Error(`The WebGL backend supports at most ${String(maxTextures)} texture bindings.`)
    }

    const gl = this._gl
    const vertex = this.compile(gl.VERTEX_SHADER, material.vertexShader.code)
    const fragment = this.compile(gl.FRAGMENT_SHADER, material.fragmentShader.code)
    const program = required(gl.createProgram(), 'Unable to create a shader program.')
    gl.attachShader(program, vertex)
    gl.attachShader(program, fragment)
    gl.linkProgram(program)
    gl.deleteShader(vertex)
    gl.deleteShader(fragment)
    if (gl.getProgramParameter(program, gl.LINK_STATUS) !== true) {
      const log = gl.getProgramInfoLog(program) ?? 'unknown error'
      gl.deleteProgram(program)
      throw new Error(`Unable to link the shader program: ${log}`)
    }

    const viewProjection = gl.getUniformLocation(program, 'uViewProjection')
    const transform = gl.getUniformLocation(program, 'uTransform')
    const textures = gl.getUniformLocation(program, 'uTextures')
    if (viewProjection === null || transform === null || textures === null) {
      gl.deleteProgram(program)
      throw new Error(
        'Material shaders must declare uViewProjection, uTransform and uTextures uniforms.',
      )
    }

    const glProgram: GlProgram = { program, viewProjection, transform, textures }
    this._programs.set(material, glProgram)

    return glProgram
  }

  private compile(type: number, code: string): WebGLShader {
    const gl = this._gl
    const shader = required(gl.createShader(type), 'Unable to create a shader.')
    gl.shaderSource(shader, code)
    gl.compileShader(shader)
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS) !== true) {
      const log = gl.getShaderInfoLog(shader) ?? 'unknown error'
      gl.deleteShader(shader)
      throw new Error(`Unable to compile a shader: ${log}`)
    }

    return shader
  }

  private mesh(mesh: GraphicMesh2D): GlMesh {
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
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, bytesPerVertex, 0)
    gl.enableVertexAttribArray(1)
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, bytesPerVertex, 8)
    gl.enableVertexAttribArray(2)
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, bytesPerVertex, 16)
    gl.bindVertexArray(null)

    const glMesh: GlMesh = { vertexArray, vertexBuffer, indexBuffer, indexCount: indices.length }
    this._meshes.set(mesh, glMesh)

    return glMesh
  }
}

function matrixValues(matrix: Matrix4x4): Float32Array {
  return new Float32Array([
    matrix.m11,
    matrix.m12,
    matrix.m13,
    matrix.m14,
    matrix.m21,
    matrix.m22,
    matrix.m23,
    matrix.m24,
    matrix.m31,
    matrix.m32,
    matrix.m33,
    matrix.m34,
    matrix.m41,
    matrix.m42,
    matrix.m43,
    matrix.m44,
  ])
}

function wrapMode(gl: WebGL2RenderingContext, mode: TextureAddressMode): number {
  switch (mode) {
    case TextureAddressMode.repeat:
      return gl.REPEAT
    case TextureAddressMode.mirroredRepeat:
      return gl.MIRRORED_REPEAT
    case TextureAddressMode.clampToEdge:
      return gl.CLAMP_TO_EDGE
    default:
      throw new Error('Unsupported texture address mode.')
  }
}

function filterMode(gl: WebGL2RenderingContext, filter: TextureFilter): number {
  return filter === TextureFilter.nearest ? gl.NEAREST : gl.LINEAR
}

function required<TValue>(value: TValue | null, message: string): TValue {
  if (value === null) {
    throw new Error(message)
  }

  return value
}
