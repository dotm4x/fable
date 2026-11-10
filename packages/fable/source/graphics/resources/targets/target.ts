import { type Vector2 } from '#/math/primitives/vectors/vector2.js'

import { Texture } from '../textures/texture.js'

/** Configuration for a render target. */
export interface RenderTargetOptions {
  /** Samples drawn per pixel. Defaults to 4; use 1 to disable multisampling. */
  readonly sampleCount?: number
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

  /**
   * @param size - Dimensions of the target, in pixels.
   * @param options - Multisampling configuration.
   * @throws {@link RangeError} If a dimension is not a positive integer or the
   * sample count is not a positive integer.
   */
  public constructor(size: Vector2, { sampleCount = 4 }: RenderTargetOptions = {}) {
    super()
    if (!Number.isInteger(size.x) || !Number.isInteger(size.y) || size.x < 1 || size.y < 1) {
      throw new RangeError('Render target dimensions must be positive integers.')
    }
    if (!Number.isInteger(sampleCount) || sampleCount < 1) {
      throw new RangeError('Render target sample counts must be positive integers.')
    }
    this._size = size
    this._sampleCount = sampleCount
  }

  /** @inheritDoc */
  public get size(): Vector2 {
    return this._size
  }

  /** Samples drawn per pixel before the target is resolved. */
  public get sampleCount(): number {
    return this._sampleCount
  }
}
