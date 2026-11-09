import { type Vector2 } from '#/math/primitives/vectors/vector2.js'

import { Texture } from '../textures/texture.js'

/**
 * A texture that can be used as an offscreen rendering destination.
 *
 * Backends manage the native GPU resources associated with the target, whose
 * contents can be sampled by later rendering operations.
 */
export class RenderTarget extends Texture {
  private readonly _size: Vector2

  /**
   * @param size - Dimensions of the target, in pixels.
   * @throws {@link RangeError} If a dimension is not a positive integer.
   */
  public constructor(size: Vector2) {
    super()
    if (!Number.isInteger(size.x) || !Number.isInteger(size.y) || size.x < 1 || size.y < 1) {
      throw new RangeError('Render target dimensions must be positive integers.')
    }
    this._size = size
  }

  /** @inheritDoc */
  public get size(): Vector2 {
    return this._size
  }
}
