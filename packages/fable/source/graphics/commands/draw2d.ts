import { type Matrix3x2 } from '#/math/primitives/matrices/matrix3x2.js'

import { type GraphicMesh2D } from '../geometry/mesh2d.js'
import { type GraphicMaterial } from '../resources/material.js'

/** Options for drawing two-dimensional geometry. */
export interface Draw2DCommandOptions {
  /** Graphical mesh containing the geometry to draw. */
  readonly mesh: GraphicMesh2D
  /** Material defining how the geometry is drawn. */
  readonly material: GraphicMaterial
  /** Transformation applied to the geometry before the camera view. */
  readonly transform: Matrix3x2
  /** Draw order within the space; lower orders are drawn first. Defaults to zero. */
  readonly order?: number
  /** Depth used by spaces that sort back to front. Defaults to zero. */
  readonly depth?: number
}

/**
 * A command to draw two-dimensional geometry.
 *
 * Backends combine the transform with the camera view and the projection for
 * the current viewport: the two-dimensional transform is applied first,
 * followed by the view and then the projection. Referenced resources are
 * borrowed and not owned by the command.
 */
export class Draw2DCommand {
  /** Graphical mesh containing the geometry to draw. */
  public readonly mesh: GraphicMesh2D

  /** Material defining how the geometry is drawn. */
  public readonly material: GraphicMaterial

  /** Transformation applied to the geometry before the camera view. */
  public readonly transform: Matrix3x2

  /** Draw order within the space; lower orders are drawn first. */
  public readonly order: number

  /** Depth used by spaces that sort back to front; larger values are farther away. */
  public readonly depth: number

  /**
   * @param options - Mesh, material, transform, order and depth.
   */
  public constructor({ mesh, material, transform, order = 0, depth = 0 }: Draw2DCommandOptions) {
    this.mesh = mesh
    this.material = material
    this.transform = transform
    this.order = order
    this.depth = depth
  }
}
