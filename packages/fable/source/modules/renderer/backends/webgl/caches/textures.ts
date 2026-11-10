import { type Image, RasterImageFormat } from '#/graphics/resources/image.js'
import { type TextureBinding } from '#/graphics/resources/textures/binding.js'
import { ImageTexture } from '#/graphics/resources/textures/image.js'
import { type Texture } from '#/graphics/resources/textures/texture.js'

import { applySampler, required } from '../helpers/index.js'

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

  /** Deletes the cached texture of one texture resource. */
  public deleteFor(texture: Texture): void {
    for (const [binding, entry] of this._textures) {
      if (binding.texture !== texture) continue
      this._textures.delete(binding)
      this._gl.deleteTexture(entry.texture)
      this._bytes -= entry.bytes
    }
  }

  /** Deletes the cached textures uploaded from an image. */
  public deleteForImage(image: Image): void {
    for (const [binding, entry] of this._textures) {
      if (!(binding.texture instanceof ImageTexture) || binding.texture.image !== image) continue
      this._textures.delete(binding)
      this._gl.deleteTexture(entry.texture)
      this._bytes -= entry.bytes
    }
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
