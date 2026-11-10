import { Node2D, type Node2DOptions } from '#/math/nodes/node2d.js'
import { Vector2 } from '#/math/primitives/vectors/vector2.js'

import { Draw2DCommand } from '../commands/draw2d.js'
import { DrawData } from '../data.js'
import { GraphicMesh2D } from '../geometry/mesh2d.js'
import { GraphicVertex2D } from '../geometry/vertex2d.js'
import { type Drawable } from '../interfaces/drawable.js'
import { Color } from '../primitives/color.js'
import { type GraphicMaterial } from '../resources/material.js'

/** Normalized texture coordinates of a sprite within its texture atlas. */
export interface SpriteRegion {
  /** Normalized coordinate of the top-left corner. */
  readonly min: Vector2
  /** Normalized coordinate of the bottom-right corner. */
  readonly max: Vector2
}

/** Configuration for a sprite node. */
export interface SpriteNodeOptions extends Node2DOptions {
  /** Material used to draw the sprite. */
  readonly material: GraphicMaterial
  /** Size of the sprite in local units. */
  readonly size: Vector2
  /** Region of the texture sampled by the sprite. Defaults to the whole texture. */
  readonly region?: SpriteRegion
  /** Vertex color multiplied with the texture. Defaults to white. */
  readonly color?: Color
  /** Draw order within its space. Defaults to zero. */
  readonly order?: number
}

/**
 * A textured quad drawn with a material and an optional atlas region.
 *
 * Sprites sharing a material are batched by the backend, so atlas sprites only
 * cost extra draw calls when their material changes.
 */
export class SpriteNode extends Node2D implements Drawable {
  private readonly _mesh: GraphicMesh2D
  private readonly _material: GraphicMaterial
  private readonly _order: number

  /**
   * @param options - Material, size, atlas region, color, order and node options.
   * @throws {@link RangeError} If the region is not normalized or is inverted.
   */
  public constructor({
    material,
    size,
    region,
    color = Color.white,
    order = 0,
    ...options
  }: SpriteNodeOptions) {
    super(options)
    const min = region?.min ?? new Vector2(0, 0)
    const max = region?.max ?? new Vector2(1, 1)
    for (const value of [min.x, min.y, max.x, max.y]) {
      if (value < 0 || value > 1) {
        throw new RangeError('Sprite regions must be normalized between zero and one.')
      }
    }

    if (max.x < min.x || max.y < min.y) {
      throw new RangeError('Sprite regions must not be inverted.')
    }

    this._material = material
    this._order = order
    const halfWidth = size.x / 2
    const halfHeight = size.y / 2
    const corners: readonly (readonly [number, number, number, number])[] = [
      [-halfWidth, -halfHeight, min.x, min.y],
      [halfWidth, -halfHeight, max.x, min.y],
      [halfWidth, halfHeight, max.x, max.y],
      [-halfWidth, halfHeight, min.x, max.y],
    ]
    this._mesh = new GraphicMesh2D(
      corners.map(
        ([x, y, u, v]) => new GraphicVertex2D(new Vector2(x, y), new Vector2(u, v), color),
      ),
      [0, 1, 2, 0, 2, 3],
    )
  }

  /** @inheritDoc */
  public draw(): DrawData {
    return new DrawData([
      new Draw2DCommand({
        mesh: this._mesh,
        material: this._material,
        transform: this.globalTransform,
        order: this._order,
      }),
    ])
  }
}
