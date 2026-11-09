import { IdentifiableSet } from '#/core/collections/identifiable-set.js'
import { Store } from '#/core/events/store.js'
import { Module, ModuleState } from '#/core/module.js'
import { Once } from '#/core/primitives/once.js'
import { ClearCommand } from '#/graphics/commands/clear.js'
import { Color } from '#/graphics/primitives/color.js'
import { Viewport } from '#/graphics/primitives/viewport.js'
import { type RenderTarget } from '#/graphics/resources/targets/target.js'
import { Vector2 } from '#/math/primitives/vectors/vector2.js'

import { type UpdateContext } from '../time/context.js'
import { type Updatable } from '../time/interfaces/updatable.js'

import { type RenderBackend } from './backends/backend.js'
import { type RenderSpace } from './spaces/space.js'
import { RenderContext } from './context.js'

/** Configuration for the renderer module. */
export interface RendererModuleOptions {
  /** Backend whose ownership transfers to the module. */
  readonly backend: RenderBackend
  /** Initial spaces whose ownership transfers to the module. */
  readonly spaces?: Iterable<RenderSpace>
  /** Color used to clear the drawing surface. Defaults to black. */
  readonly clearColor?: Color
}

/**
 * Draws registered spaces through a rendering backend.
 *
 * The module owns its backend and spaces. Each frame clears the surface once
 * and collects the commands of every space in priority order, using the space
 * camera and the backend viewport. Spaces without a camera are rejected before
 * their commands are produced.
 */
export class RendererModule extends Module implements Updatable {
  private readonly _preparation: Once = new Once(
    'Renderer module preparation has already failed or is in progress.',
  )
  private readonly _spaces: IdentifiableSet<RenderSpace> = new IdentifiableSet<RenderSpace>()
  private _rendering: boolean = false

  /** Backend owned by this module. */
  public readonly backend: RenderBackend

  /** Color used to clear the drawing surface at the start of each frame. */
  public readonly clearColor: Store<Color>

  /**
   * @param options - Backend, initial spaces and clear color.
   * @throws {@link Error} If space identifiers are duplicated.
   */
  public constructor({ backend, spaces = [], clearColor = Color.black }: RendererModuleOptions) {
    super({ identifier: 'org.js.fable.RendererModule' })
    this.backend = backend
    this.clearColor = new Store(clearColor)
    for (const space of spaces) this._spaces.add(space)
  }

  /** Spaces indexed by identifier. The module retains ownership. */
  public get spaces(): ReadonlyMap<string, RenderSpace> {
    const spaces = new Map<string, RenderSpace>()
    for (const space of this._spaces) spaces.set(space.identifier, space)
    return spaces
  }

  /** Yields additional spaces whose ownership transfers to the module, once. */
  protected *compose(): Generator<RenderSpace, void, unknown> {
    // Override to yield spaces.
  }

  /** Configures the module once after composition. */
  protected configure(): void {
    // Override to configure the module.
  }

  protected override onStart(): void {
    this._preparation.execute(() => {
      for (const space of this.compose()) this._spaces.add(space)
      this.configure()
    })
  }

  /**
   * Registers a space, transferring its ownership to the module.
   *
   * @param space - Space to register.
   * @throws {@link Error} If the space is destroyed or its identifier is duplicated.
   */
  public add(space: RenderSpace): void {
    this.throwIfDestroyed()
    this._spaces.add(space)
  }

  /**
   * Removes a space and returns its ownership to the caller.
   *
   * @param identifier - Identifier of the space to remove.
   * @returns The removed space, or undefined when it is not registered.
   */
  public remove(identifier: string): RenderSpace | undefined {
    this.throwIfDestroyed()
    const space = this._spaces.get(identifier)
    if (space === undefined) return undefined
    this._spaces.delete(space)
    return space
  }

  /** @inheritDoc */
  public update(context: UpdateContext): void {
    this.render(context.deltaTime)
  }

  /**
   * Draws the registered spaces.
   *
   * The surface and every used offscreen target are cleared once, then each
   * space collects its commands and the backend executes them in priority
   * order. Failed drawing still ends the active frame.
   *
   * @param deltaTime - Delta time offered to drawable objects, in seconds.
   * @throws {@link Error} If the module is not running or a space has no camera.
   */
  public render(deltaTime: number): void {
    this.throwIfDestroyed()
    if (this.state.value !== ModuleState.running) {
      throw new Error('The renderer must be running before drawing.')
    }
    if (this._rendering) {
      throw new Error('The renderer cannot draw recursively.')
    }

    this._rendering = true
    try {
      const backend = this.backend
      backend.beginFrame()
      try {
        const clear = new ClearCommand(this.clearColor.value)
        const cleared = new Set<RenderTarget>()
        backend.render([clear])
        const spaces = [...this._spaces].sort((left, right) => left.priority - right.priority)
        for (const space of spaces) {
          const target = space.target.value
          if (target !== undefined && !cleared.has(target)) {
            cleared.add(target)
            backend.render([new ClearCommand(this.clearColor.value)], undefined, target)
          }
          const viewport =
            target === undefined ? backend.viewport : new Viewport(new Vector2(0, 0), target.size)
          const context = new RenderContext(deltaTime, space.camera.value, viewport)
          backend.render(space.collect(context), context, target)
        }
      } finally {
        backend.endFrame()
      }
    } finally {
      this._rendering = false
    }
  }

  protected override onDestroy(): void {
    if (!this.state.destroyed && this.state.value !== ModuleState.idle) {
      throw new Error(`Module '${this.identifier}' cannot be destroyed while not idle.`)
    }
    for (const space of [...this._spaces]) {
      if (!space.destroyed) space.destroy()
    }
    this._spaces.clear()
    if (!this.clearColor.destroyed) this.clearColor.destroy()
    if (!this.backend.destroyed) this.backend.destroy()
    super.onDestroy()
  }
}
