import { type TextureSampler } from './sampler.js'
import { type Texture } from './texture.js'

/**
 * Associates a texture with the sampler used to access it during rendering.
 *
 * The texture and sampler are borrowed and are not owned by the binding.
 */
export class TextureBinding {
  /** Texture to sample. */
  public readonly texture: Texture

  /** Sampler that defines how the texture is sampled. */
  public readonly sampler: TextureSampler

  /**
   * @param texture - Texture to sample.
   * @param sampler - Sampler used to sample the texture.
   */
  public constructor(texture: Texture, sampler: TextureSampler) {
    this.texture = texture
    this.sampler = sampler
  }
}
