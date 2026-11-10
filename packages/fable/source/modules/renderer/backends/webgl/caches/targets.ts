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
}

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
