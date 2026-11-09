import { Store } from '#/core/events/store.js'
import { Node, type NodeOptions } from '#/core/node/node.js'

import { Matrix3x2 } from '../primitives/matrices/matrix3x2.js'
import { Vector2 } from '../primitives/vectors/vector2.js'

/** Configuration for a node positioned in two-dimensional space. */
export interface Node2DOptions extends NodeOptions {
  /** Initial origin used for rotation and scaling. Defaults to `(0, 0)`. */
  readonly origin?: Vector2
  /** Initial position relative to the nearest {@link Node2D} ancestor. Defaults to `(0, 0)`. */
  readonly position?: Vector2
  /** Initial local rotation in radians. Defaults to `0`. */
  readonly rotation?: number
  /** Initial local scale. Defaults to `(1, 1)`. */
  readonly scale?: Vector2
}

/**
 * A node positioned in two-dimensional space.
 *
 * Origin, position, rotation and scale determine the transformation of this
 * node and its {@link Node2D} descendants. Ordinary nodes between `Node2D`
 * instances organize the tree without contributing a transformation.
 */
export class Node2D extends Node {
  /** Origin around which this node and its descendants are scaled and rotated. */
  public readonly origin: Store<Vector2>

  /** Position of the origin relative to the nearest {@link Node2D} ancestor. */
  public readonly position: Store<Vector2>

  /** Local rotation, expressed in radians. */
  public readonly rotation: Store<number>

  /** Local scale. */
  public readonly scale: Store<Vector2>

  private _transform: Matrix3x2 = Matrix3x2.identity
  private _cachedOrigin: Vector2 | undefined
  private _cachedPosition: Vector2 | undefined
  private _cachedRotation: number | undefined
  private _cachedScale: Vector2 | undefined
  private _transformCached: boolean = false

  /**
   * Creates a two-dimensional node.
   *
   * @param options - Node configuration, including the initial transformation values.
   */
  public constructor({
    origin = new Vector2(0, 0),
    position = new Vector2(0, 0),
    rotation = 0,
    scale = new Vector2(1, 1),
    name = 'Node2D',
    ...options
  }: Node2DOptions = {}) {
    super({ ...options, name })
    this.origin = new Store(origin)
    this.position = new Store(position)
    this.rotation = new Store(rotation)
    this.scale = new Store(scale)
  }

  /**
   * World position of this node's origin.
   *
   * Getting the position derives it from {@link globalTransform}. Setting it
   * converts the supplied world position into the local space defined by the
   * {@link Node2D} ancestors and updates {@link position}.
   *
   * @throws {@link Error} If the ancestor transformation cannot be inverted.
   */
  public get globalPosition(): Vector2 {
    return this.globalTransform.transform(this.origin.value)
  }

  public set globalPosition(value: Vector2) {
    const inverse = this.parentTransform.invert()
    if (inverse === undefined) {
      throw new Error('The Node2D parent transformation cannot be inverted.')
    }

    this.position.value = inverse.transform(value)
  }

  /**
   * World rotation of this node, expressed in radians.
   *
   * Getting the rotation derives it from {@link globalTransform}. Setting it
   * updates {@link rotation} with the value required relative to the
   * {@link Node2D} ancestors.
   */
  public get globalRotation(): number {
    const transform = this.globalTransform

    return Math.atan2(transform.m12, transform.m11)
  }

  public set globalRotation(value: number) {
    const transform = this.parentTransform

    this.rotation.value = value - Math.atan2(transform.m12, transform.m11)
  }

  /**
   * This node's transformation after applying its {@link Node2D} ancestors.
   *
   * Ancestors that are not `Node2D` instances are skipped. Without a `Node2D`
   * ancestor, the local transformation is the global transformation.
   */
  public get globalTransform(): Matrix3x2 {
    let transform = this.localTransform
    let ancestor = this.parent

    while (ancestor !== undefined) {
      if (ancestor instanceof Node2D) transform = transform.multiply(ancestor.localTransform)

      ancestor = ancestor.parent
    }

    return transform
  }

  /**
   * The transformation defined by this node's local values.
   *
   * The matrix is recalculated only when the origin, position, rotation or
   * scale has changed since the previous read.
   */
  public get localTransform(): Matrix3x2 {
    const origin = this.origin.value
    const position = this.position.value
    const rotation = this.rotation.value
    const scale = this.scale.value

    if (
      !this._transformCached ||
      origin !== this._cachedOrigin ||
      position !== this._cachedPosition ||
      rotation !== this._cachedRotation ||
      scale !== this._cachedScale
    ) {
      this._transform = Matrix3x2.translation(-origin.x, -origin.y)
        .multiply(Matrix3x2.scaling(scale.x, scale.y))
        .multiply(Matrix3x2.rotation(rotation))
        .multiply(Matrix3x2.translation(position.x, position.y))

      this._cachedOrigin = origin
      this._cachedPosition = position
      this._cachedRotation = rotation
      this._cachedScale = scale
      this._transformCached = true
    }

    return this._transform
  }

  private get parentTransform(): Matrix3x2 {
    let transform = Matrix3x2.identity
    let ancestor = this.parent

    while (ancestor !== undefined) {
      if (ancestor instanceof Node2D) transform = transform.multiply(ancestor.localTransform)

      ancestor = ancestor.parent
    }

    return transform
  }

  protected override onDestroy(): void {
    super.onDestroy()
    if (!this.origin.destroyed) this.origin.destroy()
    if (!this.position.destroyed) this.position.destroy()
    if (!this.rotation.destroyed) this.rotation.destroy()
    if (!this.scale.destroyed) this.scale.destroy()
  }
}
