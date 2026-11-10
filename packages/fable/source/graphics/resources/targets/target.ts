import { type Vector2 } from '#/math/primitives/vectors/vector2.js'

import { Texture } from '../textures/texture.js'

/** Pixel formats supported by render targets. */
export enum RenderTargetFormat {
  /** Four 8-bit normalized channels. */
  rgba8 = 'rgba8',
  /** Four 16-bit floating point channels, suitable for HDR rendering. */
  rgba16f = 'rgba16f',
}

/** Configuration for a render target. */
export interface RenderTargetOptions {
  /** Samples drawn per pixel. Defaults to 4; use 1 to disable multisampling. */
  readonly sampleCount?: number
  /** Pixel format. Defaults to rgba8. */
  readonly format?: RenderTargetFormat
  /** Whether mipmaps are generated when the target is sampled. Defaults to false. */
  readonly mipmaps?: boolean
}

/**
 * A texture that can be used as an offscreen rendering destination.
 *
 * Backends manage the native GPU resources associated with the target, whose
 * contents can be sampled by later rendering operations. Multisampled targets
 * are resolved into a single-sample texture before they are sampled.
 */
export class RenderTarget extends Texture {
  private readonly _size: Vector2
  private readonly _sampleCount: number
  private readonly _format: RenderTargetFormat
  private readonly _mipmaps: boolean

  /**
   * @param size - Dimensions of the target, in pixels.
   * @param options - Multisampling configuration.
   * @throws {@link RangeError} If a dimension is not a positive integer or the
   * sample count is not a positive integer.
   */
  public constructor(
    size: Vector2,
    {
      sampleCount = 4,
      format = RenderTargetFormat.rgba8,
      mipmaps = false,
    }: RenderTargetOptions = {},
  ) {
    super()
    if (!Number.isInteger(size.x) || !Number.isInteger(size.y) || size.x < 1 || size.y < 1) {
      throw new RangeError('Render target dimensions must be positive integers.')
    }

    if (!Number.isInteger(sampleCount) || sampleCount < 1) {
      throw new RangeError('Render target sample counts must be positive integers.')
    }

    this._size = size
    this._sampleCount = sampleCount
    this._format = format
    this._mipmaps = mipmaps
  }

  /** @inheritDoc */
  public get size(): Vector2 {
    return this._size
  }

  /** Samples drawn per pixel before the target is resolved. */
  public get sampleCount(): number {
    return this._sampleCount
  }

  /** Pixel format of the target. */
  public get format(): RenderTargetFormat {
    return this._format
  }

  /** Whether mipmaps are generated when the target is sampled. */
  public get mipmaps(): boolean {
    return this._mipmaps
  }
}
