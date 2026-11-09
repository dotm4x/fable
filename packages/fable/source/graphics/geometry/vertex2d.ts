import { type Vector2 } from '#/math/primitives/vectors/vector2.js'

import { type Color } from '../primitives/color.js'

/**
 * A two-dimensional vertex prepared for graphical rendering.
 *
 * The vertex holds its local position, texture coordinate and color. It is
 * immutable and compared by value.
 */
export class GraphicVertex2D {
  /** Local position of the vertex. */
  public readonly position: Vector2

  /** Texture coordinate associated with the vertex. */
  public readonly textureCoordinate: Vector2

  /** Color associated with the vertex. */
  public readonly color: Color

  /**
   * @param position - The local position of the vertex.
   * @param textureCoordinate - The texture coordinate associated with the vertex.
   * @param color - The color associated with the vertex.
   */
  public constructor(position: Vector2, textureCoordinate: Vector2, color: Color) {
    this.position = position
    this.textureCoordinate = textureCoordinate
    this.color = color
  }

  /**
   * Compares this vertex with another by value.
   *
   * @param other - The vertex to compare with.
   * @param tolerance - Absolute tolerance used for the position and texture coordinate.
   * @returns Whether both vertices have equal attributes.
   */
  public equals(other: GraphicVertex2D, tolerance = 1e-10): boolean {
    return (
      this.position.equals(other.position, tolerance) &&
      this.textureCoordinate.equals(other.textureCoordinate, tolerance) &&
      this.color.equals(other.color)
    )
  }
}
