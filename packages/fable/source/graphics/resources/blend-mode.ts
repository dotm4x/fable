/** Specifies how drawn colors are combined with the destination surface. */
export enum BlendMode {
  /** Replaces the destination color. */
  opaque = 'opaque',
  /** Blends with the destination using the source alpha. */
  alpha = 'alpha',
  /** Adds the source color to the destination. */
  additive = 'additive',
  /** Multiplies the source and destination colors. */
  multiply = 'multiply',
}
