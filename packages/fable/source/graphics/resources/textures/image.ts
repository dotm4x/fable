import { Vector2 } from '#/math/primitives/vectors/vector2.js'

import { type Image } from '../image.js'

import { Texture } from './texture.js'

/**
 * A texture whose contents originate from an image.
 *
 * The source image is borrowed and is not destroyed with the texture.
 */
export class ImageTexture extends Texture {
  /** Source image of the texture. */
  public readonly image: Image

  /**
   * @param image - Image borrowed as the texture contents.
   * @throws {@link Error} If the image is destroyed.
   */
  public constructor(image: Image) {
    super()
    if (image.destroyed) {
      throw new Error('The source image is destroyed.')
    }

    this.image = image
  }

  /** @inheritDoc */
  public get size(): Vector2 {
    return new Vector2(this.image.width, this.image.height)
  }
}
