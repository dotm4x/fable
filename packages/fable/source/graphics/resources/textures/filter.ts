/** Specifies how texels are filtered when sampling a texture. */
export enum TextureFilter {
  /** Selects the nearest texel to the sampled texture coordinate. */
  nearest = 'nearest',
  /** Interpolates between neighboring texels around the sampled coordinate. */
  linear = 'linear',
}
