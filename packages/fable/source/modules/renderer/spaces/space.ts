import { ReactiveSet } from '#/core/collections/reactive-set.js'
import { Store } from '#/core/events/store.js'
import { type Identifiable } from '#/core/interfaces/identifiable.js'
import { Destroyable } from '#/core/primitives/destroyable.js'
import { Once } from '#/core/primitives/once.js'
import { type DrawCommand } from '#/graphics/commands/command.js'
import { Draw2DCommand } from '#/graphics/commands/draw2d.js'
import { type Camera } from '#/graphics/interfaces/camera.js'
import { type DrawContext } from '#/graphics/interfaces/context.js'
import { type Drawable } from '#/graphics/interfaces/drawable.js'
import { type GraphicMaterial } from '#/graphics/resources/material.js'
import { type RenderTarget } from '#/graphics/resources/targets/target.js'
import { Vector2 } from '#/math/primitives/vectors/vector2.js'
import { Vector4 } from '#/math/primitives/vectors/vector4.js'

/** Drawing priority of a space. Lower priorities are collected first. */
export enum RenderSpacePriority {
  low,
  normal,
  high,
  critical,
}

/** Configuration for a rendering space. */
export interface RenderSpaceOptions {
  /** Unique space identifier. */
  readonly identifier: string
  /** Initial camera used to draw the space. */
  readonly camera: Camera
  /** Collection priority. Defaults to normal. */
  readonly priority?: RenderSpacePriority
  /** Initial offscreen target, or undefined to draw to the window. */
  readonly target?: RenderTarget
  /** Whether commands outside the camera view are skipped. Defaults to true. */
  readonly cull?: boolean
  /** Initial borrowed drawable entries. */
  readonly entries?: Iterable<Drawable>
}

/**
 * Groups drawable objects and collects their commands into a single space.
 *
 * Entries are borrowed and evaluated in registration order. The space does not
 * execute commands or depend on a backend.
 */
export class RenderSpace extends Destroyable implements Identifiable<string> {
  private readonly _preparation: Once = new Once(
    'Rendering space preparation has already failed or is in progress.',
  )

  /** Unique space identifier. */
  public readonly identifier: string

  /** Borrowed camera used to draw this space. */
  public readonly camera: Store<Camera>

  /** Collection priority. */
  public readonly priority: RenderSpacePriority

  /** Borrowed offscreen target, or undefined to draw to the window. */
  public readonly target: Store<RenderTarget | undefined>

  /** Whether commands outside the camera view are skipped. */
  public readonly cull: boolean

  /** Borrowed drawable entries. */
  public readonly entries: ReactiveSet<Drawable>

  /**
   * @param options - Space identifier, camera, priority and initial entries.
   * @throws {@link Error} If the identifier is empty or repeated in the entries.
   */
  public constructor({
    identifier,
    camera,
    priority = RenderSpacePriority.normal,
    target,
    cull = true,
    entries = [],
  }: RenderSpaceOptions) {
    super()
    if (!identifier.trim()) {
      throw new Error('Rendering space identifier must not be empty.')
    }

    this.identifier = identifier
    this.priority = priority
    this.camera = new Store(camera)
    this.target = new Store(target)
    this.cull = cull
    this.entries = new ReactiveSet(entries)
  }

  /** Yields additional borrowed drawable entries, once. */
  protected *compose(): Generator<Drawable, void, unknown> {
    // Override to yield entries.
  }

  /** Configures the space once after composition. */
  protected configure(): void {
    // Override to configure the space.
  }

  /**
   * Collects the commands produced by the space entries.
   *
   * @param context - Frame state offered to drawable entries.
   * @returns Commands in entry and command order.
   * @throws {@link Error} If the space is destroyed or an entry fails.
   */
  public collect(context: DrawContext): DrawCommand[] {
    this.throwIfDestroyed()
    this._preparation.execute(() => {
      for (const entry of this.compose()) this.entries.add(entry)
      this.configure()
    })

    const commands: DrawCommand[] = []
    for (const entry of this.entries) {
      commands.push(...entry.draw(context).commands)
    }

    const visible = this.cull
      ? commands.filter((command) => this.isVisible(command, context))
      : commands
    const materials = new Map<GraphicMaterial, number>()
    for (const command of visible) {
      if (command instanceof Draw2DCommand && !materials.has(command.material)) {
        materials.set(command.material, materials.size)
      }
    }
    visible.sort(
      (left, right) =>
        orderOf(left) - orderOf(right) ||
        materialOf(left, materials) - materialOf(right, materials),
    )

    return visible
  }

  private isVisible(command: DrawCommand, context: DrawContext): boolean {
    if (!(command instanceof Draw2DCommand)) return true

    const viewProjection = context.camera
      .getProjection(context.viewport)
      .multiply(context.camera.view)
    const { min, max } = command.mesh.bounds
    let outsideLeft = true
    let outsideRight = true
    let outsideBelow = true
    let outsideAbove = true
    for (const corner of [
      new Vector2(min.x, min.y),
      new Vector2(max.x, min.y),
      new Vector2(max.x, max.y),
      new Vector2(min.x, max.y),
    ]) {
      const world = command.transform.transform(corner)
      const clip = viewProjection.transform(new Vector4(world.x, world.y, 0, 1))
      const limit = Math.abs(clip.w)
      if (clip.x >= -limit) outsideLeft = false
      if (clip.x <= limit) outsideRight = false
      if (clip.y >= -limit) outsideBelow = false
      if (clip.y <= limit) outsideAbove = false
    }

    return !(outsideLeft || outsideRight || outsideBelow || outsideAbove)
  }

  protected override onDestroy(): void {
    this.entries.clear()
    if (!this.camera.destroyed) this.camera.destroy()
    if (!this.target.destroyed) this.target.destroy()
    super.onDestroy()
  }
}

function orderOf(command: DrawCommand): number {
  return command instanceof Draw2DCommand ? command.order : 0
}

function materialOf(command: DrawCommand, materials: ReadonlyMap<GraphicMaterial, number>): number {
  return command instanceof Draw2DCommand ? (materials.get(command.material) ?? 0) : -1
}
