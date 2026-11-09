/** Specifies how texture coordinates outside the normalized range are resolved. */
export enum TextureAddressMode {
  /** Repeats the texture when coordinates extend beyond its bounds. */
  repeat = 'repeat',
  /** Repeats the texture while mirroring it on each repetition. */
  mirroredRepeat = 'mirrored-repeat',
  /** Clamps texture coordinates to the edge of the texture. */
  clampToEdge = 'clamp-to-edge',
}
