import { type GraphicMesh2D } from '#/graphics/geometry/mesh2d.js'
import { RasterImageFormat } from '#/graphics/resources/image.js'
import { type GraphicMaterial } from '#/graphics/resources/material.js'
import { type Shader, ShaderLanguage } from '#/graphics/resources/shader.js'
import { type RenderTarget, RenderTargetFormat } from '#/graphics/resources/targets/target.js'
import { type TextureBinding } from '#/graphics/resources/textures/binding.js'
import { ImageTexture } from '#/graphics/resources/textures/image.js'

import { applySampler, required } from './helpers/index.js'

const floatsPerVertex = 8
const bytesPerVertex = floatsPerVertex * 4

/** A compiled program and the locations of the standard uniforms. */
export interface GlProgram {
  readonly program: WebGLProgram
  readonly transform: WebGLUniformLocation
  readonly viewProjection: WebGLUniformLocation
  readonly textures: WebGLUniformLocation
  readonly uniforms: Map<string, WebGLUniformLocation | null>
}

/** A mesh uploaded into a vertex array object. */
export interface GlMesh {
  readonly vertexArray: WebGLVertexArrayObject
  readonly vertexBuffer: WebGLBuffer
  readonly indexBuffer: WebGLBuffer
  readonly indexCount: number
}

/** A framebuffer and its color texture. */
export interface GlTarget {
  /** Framebuffer that receives drawing commands. */
  readonly framebuffer: WebGLFramebuffer
  /** Single-sample texture holding the resolved contents. */
  readonly texture: WebGLTexture
  /** Multisample framebuffer resolved into {@link texture}, when multisampled. */
  readonly resolveFramebuffer: WebGLFramebuffer | undefined
  /** Multisample color renderbuffer, when multisampled. */
  readonly renderbuffer: WebGLRenderbuffer | undefined
  /** Number of samples drawn per pixel. */
  readonly sampleCount: number
}

/** Compiles and caches GLSL programs per material. */
export class GlPrograms {
  private readonly _gl: WebGL2RenderingContext
  private readonly _programs: Map<GraphicMaterial, GlProgram> = new Map<
    GraphicMaterial,
    GlProgram
  >()

  public constructor(gl: WebGL2RenderingContext) {
    this._gl = gl
  }

  /** Returns the program for a material, compiling it on first use. */
  public get(material: GraphicMaterial): GlProgram {
    if (material.destroyed) {
      throw new Error('The material is destroyed.')
    }

    const cached = this._programs.get(material)
    if (cached !== undefined) return cached
    if (
      material.vertexShader.language !== ShaderLanguage.glsl ||
      material.fragmentShader.language !== ShaderLanguage.glsl
    ) {
      throw new Error('The WebGL backend requires GLSL shader sources.')
    }

    const gl = this._gl
    const vertex = this.compile(gl.VERTEX_SHADER, material.vertexShader)
    const fragment = this.compile(gl.FRAGMENT_SHADER, material.fragmentShader)
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

    const glProgram: GlProgram = {
      program,
      viewProjection,
      transform,
      textures,
      uniforms: new Map<string, WebGLUniformLocation | null>(),
    }
    this._programs.set(material, glProgram)

    return glProgram
  }

  /**
   * Returns the location of a custom uniform, or undefined when the shaders do
   * not use it.
   *
   * Locations are resolved once per program.
   *
   * @param program - Program declaring the uniform.
   * @param name - Uniform name.
   */
  public uniformLocation(program: GlProgram, name: string): WebGLUniformLocation | undefined {
    const cached = program.uniforms.get(name)
    if (cached !== undefined) return cached ?? undefined
    const location = this._gl.getUniformLocation(program.program, name)
    program.uniforms.set(name, location)

    return location ?? undefined
  }

  /** Deletes one compiled program. */
  public delete(material: GraphicMaterial): void {
    const cached = this._programs.get(material)
    if (cached === undefined) return
    this._gl.deleteProgram(cached.program)
    this._programs.delete(material)
  }

  /** Deletes every compiled program. */
  public clear(): void {
    for (const program of this._programs.values()) this._gl.deleteProgram(program.program)
    this._programs.clear()
  }

  private compile(type: number, shader: Shader): WebGLShader {
    const gl = this._gl
    const compiled = required(gl.createShader(type), 'Unable to create a shader.')
    gl.shaderSource(compiled, shader.code)
    gl.compileShader(compiled)
    if (gl.getShaderParameter(compiled, gl.COMPILE_STATUS) !== true) {
      const log = gl.getShaderInfoLog(compiled) ?? 'unknown error'
      gl.deleteShader(compiled)
      throw new Error(`Unable to compile a shader: ${log}`)
    }

    return compiled
  }
}

/** Uploads and caches vertex arrays per mesh. */
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

/** An uploaded texture and the size of its source data. */
interface GlTextureEntry {
  readonly texture: WebGLTexture
  readonly bytes: number
}

/**
 * Uploads and caches textures for bindings, including a white fallback.
 *
 * The cache keeps least recently used textures while they fit the VRAM budget.
 * Evicted textures are re-uploaded from their source when used again.
 */
export class GlTextures {
  private readonly _gl: WebGL2RenderingContext
  private readonly _textures: Map<TextureBinding, GlTextureEntry> = new Map<
    TextureBinding,
    GlTextureEntry
  >()

  private _whiteTexture: WebGLTexture | undefined
  private _budget: number
  private _bytes: number = 0

  public constructor(gl: WebGL2RenderingContext, budget: number) {
    this._gl = gl
    this._budget = budget
  }

  /** Bytes of texture data currently uploaded. */
  public get bytes(): number {
    return this._bytes
  }

  /** Number of cached textures, excluding the white fallback. */
  public get count(): number {
    return this._textures.size
  }

  /** VRAM budget of the cache, in bytes. */
  public get budget(): number {
    return this._budget
  }

  public set budget(value: number) {
    if (!Number.isFinite(value) || value < 0) {
      throw new RangeError('The texture budget must be a nonnegative number.')
    }

    this._budget = value
    this.trim()
  }

  /** Returns the white texture used for unused slots. */
  public get white(): WebGLTexture {
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

  /** Uploads the image of a binding and applies its sampler. */
  public get(binding: TextureBinding): WebGLTexture {
    if (binding.texture.destroyed) {
      throw new Error('The texture is destroyed.')
    }

    if (!(binding.texture instanceof ImageTexture)) {
      throw new Error('The WebGL backend only supports image and render target textures.')
    }

    const cached = this._textures.get(binding)
    if (cached !== undefined) {
      this._textures.delete(binding)
      this._textures.set(binding, cached)

      return cached.texture
    }

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
    applySampler(gl, binding.sampler, binding.sampler.mipmaps)
    if (binding.sampler.mipmaps) gl.generateMipmap(gl.TEXTURE_2D)
    const bytes = image.dataSize
    this._textures.set(binding, { texture, bytes })
    this._bytes += bytes
    this.trim()

    return texture
  }

  /** Releases every cached texture, keeping the white fallback. */
  public release(): void {
    for (const entry of this._textures.values()) this._gl.deleteTexture(entry.texture)
    this._textures.clear()
    this._bytes = 0
  }

  /** Deletes every uploaded texture. */
  public clear(): void {
    this.release()
    if (this._whiteTexture !== undefined) {
      this._gl.deleteTexture(this._whiteTexture)
      this._whiteTexture = undefined
    }
  }

  private trim(): void {
    while (this._bytes > this._budget && this._textures.size > 1) {
      const oldest = this._textures.keys().next()
      if (oldest.done === true) return
      const entry = this._textures.get(oldest.value)
      if (entry === undefined) return
      this._textures.delete(oldest.value)
      this._gl.deleteTexture(entry.texture)
      this._bytes -= entry.bytes
    }
  }
}

/** Creates and caches framebuffers for render targets. */
export class GlTargets {
  private readonly _gl: WebGL2RenderingContext
  private readonly _targets: Map<RenderTarget, GlTarget> = new Map<RenderTarget, GlTarget>()

  public constructor(gl: WebGL2RenderingContext) {
    this._gl = gl
  }

  /** Returns the framebuffer for a target, creating it on first use. */
  public get(target: RenderTarget): GlTarget {
    const cached = this._targets.get(target)
    if (cached !== undefined) return cached

    const gl = this._gl
    const size = target.size
    const float = target.format === RenderTargetFormat.rgba16f
    const internalFormat = float ? gl.RGBA16F : gl.RGBA8
    const type = float ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE
    const texture = required(gl.createTexture(), 'Unable to create a target texture.')
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, size.x, size.y, 0, gl.RGBA, type, null)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

    const resolveFramebuffer = this.createFramebuffer(texture)
    const multisampled = target.sampleCount > 1
    const renderbuffer = multisampled
      ? this.createRenderbuffer(target.sampleCount, internalFormat, size.x, size.y)
      : undefined
    const framebuffer = multisampled
      ? this.createFramebuffer(renderbuffer ?? null, true)
      : resolveFramebuffer

    const glTarget: GlTarget = {
      framebuffer,
      texture,
      resolveFramebuffer: multisampled ? resolveFramebuffer : undefined,
      renderbuffer,
      sampleCount: target.sampleCount,
    }
    this._targets.set(target, glTarget)

    return glTarget
  }

  /**
   * Resolves the multisample contents of a target into its texture.
   *
   * Single-sample targets are left untouched.
   *
   * @param target - Target to resolve.
   * @param framebuffer - Framebuffer to restore afterwards.
   */
  public resolve(target: RenderTarget, framebuffer: WebGLFramebuffer | null): void {
    const glTarget = this._targets.get(target)
    if (glTarget?.resolveFramebuffer === undefined) return

    const gl = this._gl
    const size = target.size
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, glTarget.framebuffer)
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, glTarget.resolveFramebuffer)
    gl.blitFramebuffer(0, 0, size.x, size.y, 0, 0, size.x, size.y, gl.COLOR_BUFFER_BIT, gl.NEAREST)
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
  }

  /** Deletes every cached framebuffer. */
  public clear(): void {
    const gl = this._gl
    for (const target of this._targets.values()) {
      gl.deleteFramebuffer(target.framebuffer)
      if (target.resolveFramebuffer !== undefined) gl.deleteFramebuffer(target.resolveFramebuffer)
      if (target.renderbuffer !== undefined) gl.deleteRenderbuffer(target.renderbuffer)
      gl.deleteTexture(target.texture)
    }

    this._targets.clear()
  }

  private createFramebuffer(
    attachment: WebGLTexture | WebGLRenderbuffer | null,
    renderbuffer: boolean = false,
  ): WebGLFramebuffer {
    const gl = this._gl
    const framebuffer = required(gl.createFramebuffer(), 'Unable to create a framebuffer.')
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
    if (renderbuffer) {
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, attachment)
    } else {
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, attachment, 0)
    }

    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      gl.deleteFramebuffer(framebuffer)
      throw new Error('The render target framebuffer is incomplete.')
    }

    return framebuffer
  }

  private createRenderbuffer(
    sampleCount: number,
    internalFormat: number,
    width: number,
    height: number,
  ): WebGLRenderbuffer {
    const gl = this._gl
    const renderbuffer = required(gl.createRenderbuffer(), 'Unable to create a renderbuffer.')
    gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer)
    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, sampleCount, internalFormat, width, height)
    gl.bindRenderbuffer(gl.RENDERBUFFER, null)

    return renderbuffer
  }
}
