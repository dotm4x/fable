import { Resource } from '#/core/primitives/resource.js'
import { type Vector2 } from '#/math/primitives/vectors/vector2.js'

/**
 * A texture that can be sampled during rendering.
 *
 * A texture describes a graphical resource independently of its source and of
 * the rendering backend. Derived types define how the texture obtains its
 * contents; backends manage the corresponding native GPU resources.
 */
export abstract class Texture extends Resource {
  /** Dimensions of the texture, in pixels. */
  public abstract get size(): Vector2
}
