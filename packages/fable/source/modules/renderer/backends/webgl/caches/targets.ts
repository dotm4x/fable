import { type RenderTarget, RenderTargetFormat } from '#/graphics/resources/targets/target.js'

import { required } from '../helpers/index.js'

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
  /** Whether the target changed since it was last resolved. */
  dirty: boolean
}

export class GlTargets {
  private readonly _gl: WebGL2RenderingContext
  private readonly _targets: Map<RenderTarget, GlTarget> = new Map<RenderTarget, GlTarget>()

  public constructor(gl: WebGL2RenderingContext) {
    this._gl = gl
  }

  /** Number of cached targets. */
  public get count(): number {
    return this._targets.size
  }

  /** Bytes occupied by the cached target textures. */
  public get bytes(): number {
    let bytes = 0
    for (const target of this._targets.keys()) {
      const size = target.size
      const pixel = target.format === RenderTargetFormat.rgba16f ? 8 : 4
      bytes += size.x * size.y * pixel
    }

    return bytes
  }

  /** Returns the framebuffer for a target, creating it on first use. */
  public get(target: RenderTarget): GlTarget {
    const cached = this._targets.get(target)
    if (cached !== undefined) return cached

    const gl = this._gl
    const float = target.format === RenderTargetFormat.rgba16f
    if (float && gl.getExtension('EXT_color_buffer_float') === null) {
      throw new Error('Float render targets require the EXT_color_buffer_float extension.')
    }

    const size = target.size
    let internalFormat: number = gl.RGBA8
    if (float) internalFormat = gl.RGBA16F
    else if (target.format === RenderTargetFormat.rgba8Srgb) internalFormat = gl.SRGB8_ALPHA8
    const type = float ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE
    const texture = required(gl.createTexture(), 'Unable to create a target texture.')
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, size.x, size.y, 0, gl.RGBA, type, null)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

    const resolveFramebuffer = this.createFramebuffer(texture)
    const samples = Math.min(target.sampleCount, gl.getParameter(gl.MAX_SAMPLES) as number)
    const multisampled = samples > 1
    const renderbuffer = multisampled
      ? this.createRenderbuffer(samples, internalFormat, size.x, size.y)
      : undefined
    const framebuffer = multisampled
      ? this.createFramebuffer(renderbuffer ?? null, true)
      : resolveFramebuffer

    const glTarget: GlTarget = {
      framebuffer,
      texture,
      resolveFramebuffer: multisampled ? resolveFramebuffer : undefined,
      renderbuffer,
      sampleCount: samples,
      dirty: true,
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
    const gl = this._gl
    const glTarget = this._targets.get(target)
    if (!glTarget?.dirty) return
    glTarget.dirty = false
    if (glTarget.resolveFramebuffer !== undefined) {
      this.blit(glTarget, target)
    }

    if (target.mipmaps) {
      gl.bindTexture(gl.TEXTURE_2D, glTarget.texture)
      gl.generateMipmap(gl.TEXTURE_2D)
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
  }

  /** Deletes the native resources of one target. */
  public delete(target: RenderTarget): void {
    const glTarget = this._targets.get(target)
    if (glTarget === undefined) return
    this._targets.delete(target)
    this.destroyTarget(glTarget)
  }

  /** Deletes every cached framebuffer. */
  public clear(): void {
    for (const target of this._targets.values()) this.destroyTarget(target)
    this._targets.clear()
  }

  private blit(glTarget: GlTarget, target: RenderTarget): void {
    const gl = this._gl
    const size = target.size
    if (glTarget.resolveFramebuffer === undefined) return
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, glTarget.framebuffer)
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, glTarget.resolveFramebuffer)
    gl.blitFramebuffer(0, 0, size.x, size.y, 0, 0, size.x, size.y, gl.COLOR_BUFFER_BIT, gl.NEAREST)
  }

  private destroyTarget(target: GlTarget): void {
    const gl = this._gl
    gl.deleteFramebuffer(target.framebuffer)
    if (target.resolveFramebuffer !== undefined) gl.deleteFramebuffer(target.resolveFramebuffer)
    if (target.renderbuffer !== undefined) gl.deleteRenderbuffer(target.renderbuffer)
    gl.deleteTexture(target.texture)
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
