import { type EventConnection } from '#/core/events/event.js'
import { type Resource } from '#/core/primitives/resource.js'
import { ClearCommand } from '#/graphics/commands/clear.js'
import { type DrawCommand } from '#/graphics/commands/command.js'
import { Draw2DCommand } from '#/graphics/commands/draw2d.js'
import { type DrawContext } from '#/graphics/interfaces/context.js'
import { type Color } from '#/graphics/primitives/color.js'
import { Viewport } from '#/graphics/primitives/viewport.js'
import { BlendMode } from '#/graphics/resources/blend-mode.js'
import { Image } from '#/graphics/resources/image.js'
import { type GraphicMaterial } from '#/graphics/resources/material.js'
import { RenderTarget, RenderTargetFormat } from '#/graphics/resources/targets/target.js'
import { type TextureBinding } from '#/graphics/resources/textures/binding.js'
import { ImageTexture } from '#/graphics/resources/textures/image.js'
import { Matrix4x4 } from '#/math/primitives/matrices/matrix4x4.js'
import { Vector2 } from '#/math/primitives/vectors/vector2.js'

import { RenderBackend, type RenderStats } from '../backend.js'

import { GlMeshes, GlPrograms, GlTargets, GlTextures } from './caches/index.js'
import { applySampler, applyUniform, matrixValues, required } from './helpers/index.js'
import { type WebGlBackendHooks } from './hooks.js'
import { createDefaultMaterial } from './shaders/draw2d.js'

const floatsPerVertex = 8
const bytesPerVertex = floatsPerVertex * 4
const maxTextures = 4

/** Configuration for a WebGL backend. */
export interface WebGlBackendOptions {
  /** Canvas borrowed as the drawing surface. */
  readonly canvas: HTMLCanvasElement
  /** Backend identifier. Defaults to `webgl`. */
  readonly identifier?: string
  /** Whether the drawing surface is antialiased. Defaults to true. */
  readonly antialias?: boolean
  /** VRAM budget of the texture cache, in bytes. Defaults to 64 MiB. */
  readonly textureBudget?: number
  /** Extension hooks invoked while rendering. */
  readonly hooks?: WebGlBackendHooks
}

/**
 * Draws two-dimensional geometry with WebGL 2.
 *
 * Native resources live in dedicated caches ({@link GlPrograms}, {@link GlMeshes},
 * {@link GlTextures} and {@link GlTargets}) so this class only coordinates
 * frames, state and batching. Extension points are available through
 * {@link WebGlBackendHooks}.
 */
export class WebGlBackend extends RenderBackend {
  private readonly _canvas: HTMLCanvasElement
  private readonly _gl: WebGL2RenderingContext
  private readonly _programs: GlPrograms
  private readonly _meshes: GlMeshes
  private readonly _textures: GlTextures
  private readonly _targets: GlTargets
  private readonly _hooks: WebGlBackendHooks
  private readonly _tracked: Map<Resource, EventConnection> = new Map<Resource, EventConnection>()
  private readonly _onContextLost: (event: Event) => void
  private readonly _onContextRestored: () => void
  private _contextLost: boolean = false
  private _target: RenderTarget | undefined
  private _framebuffer: WebGLFramebuffer | null = null
  private _drawCalls: number = 0
  private _batchCount: number = 0
  private _commandCount: number = 0
  private _skipFrame: boolean = false
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
   * @param options - Canvas, identifier, antialiasing and hooks.
   * @throws {@link Error} If a WebGL 2 context is unavailable.
   */
  public constructor({
    canvas,
    identifier = 'webgl',
    antialias = true,
    textureBudget = 64 * 1024 * 1024,
    hooks = {},
  }: WebGlBackendOptions) {
    super(identifier)
    const gl = canvas.getContext('webgl2', { antialias })
    if (gl === null) {
      throw new Error('A WebGL 2 context is unavailable.')
    }

    this._canvas = canvas
    this._gl = gl
    this._hooks = hooks
    this._programs = new GlPrograms(gl)
    this._meshes = new GlMeshes(gl)
    this._textures = new GlTextures(gl, textureBudget)
    this._targets = new GlTargets(gl)
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
      this.resetBatchBuffers()
      this._contextLost = false
    }

    canvas.addEventListener('webglcontextlost', this._onContextLost)
    canvas.addEventListener('webglcontextrestored', this._onContextRestored)
  }

  /** @inheritDoc */
  public get stats(): RenderStats {
    return {
      drawCalls: this._drawCalls,
      batches: this._batchCount,
      commands: this._commandCount,
      textures: this._textures.count,
      targets: this._targets.count,
      textureBytes: this._textures.bytes + this._targets.bytes,
    }
  }

  /** VRAM budget of the texture cache, in bytes. */
  public get textureBudget(): number {
    return this._textures.budget
  }

  public set textureBudget(value: number) {
    this._textures.budget = value
  }

  /** @inheritDoc */
  public get viewport(): Viewport {
    return new Viewport(new Vector2(0, 0), new Vector2(this._canvas.width, this._canvas.height))
  }

  private get backbufferSize(): Vector2 {
    return new Vector2(this._canvas.width, this._canvas.height)
  }

  /** @inheritDoc */
  public createMaterial(textures?: Iterable<TextureBinding>): GraphicMaterial {
    return createDefaultMaterial(textures)
  }

  /** Releases cached textures; their sources re-upload them when used again. */
  public releaseTextures(): void {
    this._textures.release()
  }

  /**
   * Reads the color contents of a render target or of the window.
   *
   * @param target - Target to read, or undefined to read the window.
   * @returns An image with the pixels ordered from top to bottom.
   * @throws {@link Error} If the target uses a format that cannot be read.
   */
  public readPixels(target?: RenderTarget): Image {
    this.throwIfDestroyed()
    if (target?.format === RenderTargetFormat.rgba16f) {
      throw new Error('Float surfaces cannot be read.')
    }

    const gl = this._gl
    const size = target === undefined ? this.backbufferSize : target.size
    const glTarget = target === undefined ? undefined : this._targets.get(target)
    if (target !== undefined) this._targets.resolve(target, null)
    gl.bindFramebuffer(
      gl.FRAMEBUFFER,
      glTarget === undefined ? null : (glTarget.resolveFramebuffer ?? glTarget.framebuffer),
    )
    const data = new Uint8Array(size.x * size.y * 4)
    gl.readPixels(0, 0, size.x, size.y, gl.RGBA, gl.UNSIGNED_BYTE, data)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)

    const flipped = new Uint8Array(data.length)
    const row = size.x * 4
    for (let y = 0; y < size.y; y++) {
      flipped.set(data.subarray((size.y - 1 - y) * row, (size.y - y) * row), y * row)
    }

    return new Image(size.x, size.y, flipped)
  }

  protected override onBeginFrame(): void {
    this._drawCalls = 0
    this._batchCount = 0
    this._commandCount = 0
    this._skipFrame = this._contextLost
    if (this._skipFrame) return
    this.syncCanvasSize()
  }

  protected override onEndFrame(): void {
    if (this._skipFrame) {
      this._skipFrame = false

      return
    }

    this._hooks.afterFrame?.()
  }

  protected override onRender(
    commands: readonly DrawCommand[],
    context: DrawContext | undefined,
    target: RenderTarget | undefined,
  ): void {
    if (this._skipFrame) return
    const gl = this._gl
    const size = target === undefined ? this.backbufferSize : target.size
    const framebuffer = target === undefined ? null : this._targets.get(target).framebuffer
    this._target = target
    this._framebuffer = framebuffer
    if (target !== undefined) this._targets.get(target).dirty = true
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
    const viewport = context?.viewport
    this.applyViewport(viewport, size)
    gl.disable(gl.SCISSOR_TEST)

    const viewProjection =
      context === undefined
        ? undefined
        : context.camera.getProjection(context.viewport).multiply(context.camera.view)

    let batch: Draw2DCommand[] = []
    const flush = (): void => {
      if (batch.length === 0) return
      if (context === undefined || viewProjection === undefined) {
        throw new Error('Drawing commands require a drawing context.')
      }

      this.applyScissor(context.viewport, size)
      this.drawBatch(batch, context, viewProjection)
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
      this._target = undefined
      this._framebuffer = null
      gl.disable(gl.SCISSOR_TEST)
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.bindVertexArray(null)
    }
  }

  protected override onDestroy(): void {
    this._canvas.removeEventListener('webglcontextlost', this._onContextLost)
    this._canvas.removeEventListener('webglcontextrestored', this._onContextRestored)
    for (const connection of this._tracked.values()) connection.destroy()
    this._tracked.clear()
    this._programs.clear()
    this._meshes.clear()
    this._textures.clear()
    this._targets.clear()
    this.deleteBatchBuffers()
    if (!this.defaultMaterial.destroyed) this.defaultMaterial.destroy()
  }

  private clear(color: Color): void {
    const gl = this._gl
    gl.disable(gl.SCISSOR_TEST)
    gl.clearColor(color.r, color.g, color.b, color.a)
    gl.clear(gl.COLOR_BUFFER_BIT)
  }

  private applyViewport(viewport: Viewport | undefined, size: Vector2): void {
    const gl = this._gl
    if (viewport === undefined) {
      gl.viewport(0, 0, size.x, size.y)

      return
    }

    gl.viewport(
      viewport.position.x,
      size.y - viewport.position.y - viewport.size.y,
      viewport.size.x,
      viewport.size.y,
    )
  }

  private applyScissor(viewport: Viewport, size: Vector2): void {
    const gl = this._gl
    if (!viewport.scissor) {
      gl.disable(gl.SCISSOR_TEST)

      return
    }

    const y = size.y - viewport.position.y - viewport.size.y
    gl.enable(gl.SCISSOR_TEST)
    gl.scissor(viewport.position.x, y, viewport.size.x, viewport.size.y)
  }

  private draw(command: Draw2DCommand, context: DrawContext, viewProjection: Matrix4x4): void {
    const gl = this._gl
    this._hooks.beforeDraw?.(command, context)
    this.applyMaterial(
      command.material,
      matrixValues(viewProjection),
      matrixValues(Matrix4x4.fromMatrix3x2(command.transform)),
    )
    const mesh = this._meshes.get(command.mesh)
    gl.bindVertexArray(mesh.vertexArray)
    gl.drawElements(gl.TRIANGLES, mesh.indexCount, gl.UNSIGNED_INT, 0)
    this._drawCalls++
    this._batchCount++
    this._commandCount++
  }

  private drawBatch(
    batch: readonly Draw2DCommand[],
    context: DrawContext,
    viewProjection: Matrix4x4,
  ): void {
    const first = batch[0]
    if (first === undefined) return
    if (batch.length === 1) {
      this.draw(first, context, viewProjection)

      return
    }

    for (const command of batch) this._hooks.beforeDraw?.(command, context)

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

    this.applyMaterial(
      first.material,
      matrixValues(viewProjection),
      matrixValues(Matrix4x4.identity),
    )
    gl.bindVertexArray(this._batchVertexArray ?? null)
    gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_INT, 0)
    this._drawCalls++
    this._batchCount++
    this._commandCount += batch.length
  }

  private applyMaterial(
    material: GraphicMaterial,
    viewProjection: Float32Array,
    transform: Float32Array,
  ): void {
    const gl = this._gl
    this.track(material, () => {
      this._programs.delete(material)
      for (const binding of material.textures) this._textures.deleteFor(binding.texture)
    })
    const program = this._programs.get(material)
    gl.useProgram(program.program)
    gl.uniformMatrix4fv(program.viewProjection, false, viewProjection)
    gl.uniformMatrix4fv(program.transform, false, transform)
    for (let index = 0; index < maxTextures; index++) {
      const binding = material.textures[index]
      gl.activeTexture(gl.TEXTURE0 + index)
      gl.bindTexture(gl.TEXTURE_2D, this.textureFor(binding))
    }

    gl.uniform1iv(program.textures, [0, 1, 2, 3])
    for (const [name, value] of material.uniforms) {
      const location = this._programs.uniformLocation(program, name)
      if (location === undefined) continue
      applyUniform(gl, location, value)
    }

    this.applyBlend(material.blend)
  }

  private textureFor(binding: TextureBinding | undefined): WebGLTexture {
    if (binding === undefined) return this._textures.white
    if (binding.texture instanceof RenderTarget) {
      const target = this._targets.get(binding.texture)
      this.track(binding.texture, () => {
        this._targets.delete(binding.texture as RenderTarget)
      })
      if (binding.texture !== this._target) {
        this._targets.resolve(binding.texture, this._framebuffer)
      }

      const gl = this._gl
      gl.bindTexture(gl.TEXTURE_2D, target.texture)
      applySampler(gl, binding.sampler, binding.texture.mipmaps)

      return target.texture
    }

    this.track(binding.texture, () => {
      this._textures.deleteFor(binding.texture)
    })
    if (binding.texture instanceof ImageTexture) {
      const image = binding.texture.image
      this.track(image, () => {
        this._textures.deleteForImage(image)
      })
    }

    return this._textures.get(binding)
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

  private track(resource: Resource, invalidate: () => void): void {
    if (resource.destroyed || this._tracked.has(resource)) return
    const connection = resource.onDestroyed.connect(() => {
      invalidate()
      this._tracked.delete(resource)
    })
    this._tracked.set(resource, connection)
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
}
