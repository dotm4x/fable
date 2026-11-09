import { Resource } from '#/core/primitives/resource.js'

import { TextureAddressMode } from './address-mode.js'
import { TextureFilter } from './filter.js'

/** Configuration for a texture sampler. */
export interface TextureSamplerOptions {
  /** Filtering used when the texture is minified. Defaults to linear. */
  readonly minFilter?: TextureFilter
  /** Filtering used when the texture is magnified. Defaults to linear. */
  readonly magFilter?: TextureFilter
  /** Addressing used for horizontal coordinates. Defaults to clamping to the edge. */
  readonly addressU?: TextureAddressMode
  /** Addressing used for vertical coordinates. Defaults to clamping to the edge. */
  readonly addressV?: TextureAddressMode
  /** Whether mipmaps are generated and sampled. Defaults to false. */
  readonly mipmaps?: boolean
}

/**
 * Describes how a texture is sampled during rendering.
 *
 * Samplers are independent of textures, so the same texture can be sampled with
 * different filtering and addressing behavior.
 */
export class TextureSampler extends Resource {
  /** Addressing mode used for horizontal texture coordinates. */
  public readonly addressU: TextureAddressMode

  /** Addressing mode used for vertical texture coordinates. */
  public readonly addressV: TextureAddressMode

  /** Filtering mode used when the texture is magnified. */
  public readonly magFilter: TextureFilter

  /** Filtering mode used when the texture is minified. */
  public readonly minFilter: TextureFilter

  /** Whether mipmaps are generated and sampled. */
  public readonly mipmaps: boolean

  /**
   * @param options - Filtering and addressing modes.
   */
  public constructor({
    minFilter = TextureFilter.linear,
    magFilter = TextureFilter.linear,
    addressU = TextureAddressMode.clampToEdge,
    addressV = TextureAddressMode.clampToEdge,
    mipmaps = false,
  }: TextureSamplerOptions = {}) {
    super()
    this.minFilter = minFilter
    this.magFilter = magFilter
    this.addressU = addressU
    this.addressV = addressV
    this.mipmaps = mipmaps
  }
}
