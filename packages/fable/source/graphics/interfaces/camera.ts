import { type Matrix4x4 } from '#/math/primitives/matrices/matrix4x4.js'

import { type Viewport } from '../primitives/viewport.js'

/**
 * Provides the transformations required to render a scene from a camera view.
 */
export interface Camera {
  /** Transformation from world space into camera view space. */
  readonly view: Matrix4x4

  /**
   * Creates the projection transformation for a viewport.
   *
   * @param viewport - The viewport for which to create the projection transformation.
   * @returns The projection transformation.
   */
  getProjection(viewport: Viewport): Matrix4x4
}
