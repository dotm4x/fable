import { type EventConnection } from '#/core/events/event.js'
import { Store } from '#/core/events/store.js'
import { Node2D, type Node2DOptions } from '#/math/nodes/node2d.js'
import { Matrix4x4 } from '#/math/primitives/matrices/matrix4x4.js'

import { type Camera } from '../interfaces/camera.js'
import { type Viewport } from '../primitives/viewport.js'

/** Configuration for a two-dimensional camera. */
export interface Camera2DOptions extends Node2DOptions {
  /** Zoom factor applied to the camera view. Defaults to `1`. */
  readonly zoom?: number
}

/**
 * A camera positioned in two-dimensional space.
 *
 * The view keeps the Y axis pointing down, so world positions map to
 * screen-space coordinates with the origin at the viewport center.
 */
export class Camera2D extends Node2D implements Camera {
  private readonly _zoomConnection: EventConnection

  /** Zoom factor applied to the camera view. */
  public readonly zoom: Store<number>

  /**
   * @param options - Node configuration and the initial zoom.
   * @throws {@link RangeError} If the zoom is not finite or is less than or equal to zero.
   */
  public constructor({ zoom = 1, ...options }: Camera2DOptions = {}) {
    super(options)
    if (!Number.isFinite(zoom) || zoom <= 0) {
      throw new RangeError('Camera zoom must be finite and greater than zero.')
    }

    this.zoom = new Store(zoom)
    this._zoomConnection = this.zoom.connect(({ previous, value }) => {
      if (Number.isFinite(value) && value > 0) return
      this.zoom.value = previous
      throw new RangeError('Camera zoom must be finite and greater than zero.')
    })
  }

  /** Transformation from world space into camera view space. */
  public get view(): Matrix4x4 {
    const position = this.globalPosition
    const rotation = this.globalRotation

    return Matrix4x4.translation(-position.x, -position.y, 0).multiply(
      Matrix4x4.rotationZ(-rotation),
    )
  }

  /**
   * Creates the projection transformation for a viewport.
   *
   * @param viewport - The viewport for which to create the projection.
   * @returns The projection transformation.
   */
  public getProjection(viewport: Viewport): Matrix4x4 {
    const zoom = this.zoom.value
    const width = viewport.size.x / zoom
    const height = viewport.size.y / zoom

    return Matrix4x4.orthographicOffCenter(-width / 2, width / 2, height / 2, -height / 2, -1, 1)
  }

  protected override onDestroy(): void {
    super.onDestroy()
    if (!this._zoomConnection.destroyed) this._zoomConnection.destroy()
    if (!this.zoom.destroyed) this.zoom.destroy()
  }
}
