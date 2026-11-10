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
  /** Anisotropic filtering level. Defaults to 1, which disables it. */
  readonly anisotropy?: number
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

  /** Anisotropic filtering level, where `1` disables it. */
  public readonly anisotropy: number

  /**
   * @param options - Filtering, addressing and anisotropic filtering options.
   * @throws {@link RangeError} If the anisotropy is not a positive integer.
   */
  public constructor({
    minFilter = TextureFilter.linear,
    magFilter = TextureFilter.linear,
    addressU = TextureAddressMode.clampToEdge,
    addressV = TextureAddressMode.clampToEdge,
    mipmaps = false,
    anisotropy = 1,
  }: TextureSamplerOptions = {}) {
    super()
    if (!Number.isInteger(anisotropy) || anisotropy < 1) {
      throw new RangeError('Texture anisotropy must be a positive integer.')
    }

    this.minFilter = minFilter
    this.magFilter = magFilter
    this.addressU = addressU
    this.addressV = addressV
    this.mipmaps = mipmaps
    this.anisotropy = anisotropy
  }
}
