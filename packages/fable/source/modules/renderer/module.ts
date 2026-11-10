import { IdentifiableSet } from '#/core/collections/identifiable-set.js'
import { Store } from '#/core/events/store.js'
import { Module, ModuleState } from '#/core/module.js'
import { Once } from '#/core/primitives/once.js'
import { Color } from '#/graphics/primitives/color.js'

import { type UpdateContext } from '../time/context.js'
import { type Updatable } from '../time/interfaces/updatable.js'

import { type RenderBackend } from './backends/backend.js'
import {
  ClearRenderPass,
  type RenderPass,
  type RenderPassContext,
  SpaceRenderPass,
} from './passes/index.js'
import { type RenderSpace } from './spaces/space.js'

/** Configuration for the renderer module. */
export interface RendererModuleOptions {
  /** Backend whose ownership transfers to the module. */
  readonly backend: RenderBackend
  /** Initial spaces whose ownership transfers to the module. */
  readonly spaces?: Iterable<RenderSpace>
  /** Additional passes whose ownership transfers to the module. */
  readonly passes?: Iterable<RenderPass>
  /** Color used to clear the drawing surface. Defaults to black. */
  readonly clearColor?: Color
}

/**
 * Draws registered spaces through a rendering backend.
 *
 * The module owns its backend, spaces and passes. Each frame executes the
 * registered passes in priority order; the built-in clear and space passes
 * clear every surface once and collect the commands of every space, using the
 * space camera and the backend viewport. Additional passes extend the pipeline
 * before, between or after them.
 */
export class RendererModule extends Module implements Updatable {
  private readonly _preparation: Once = new Once(
    'Renderer module preparation has already failed or is in progress.',
  )

  private readonly _spaces: IdentifiableSet<RenderSpace> = new IdentifiableSet<RenderSpace>()
  private readonly _passes: IdentifiableSet<RenderPass> = new IdentifiableSet<RenderPass>()
  private _rendering: boolean = false

  /** Backend owned by this module. */
  public readonly backend: RenderBackend

  /** Color used to clear the drawing surface at the start of each frame. */
  public readonly clearColor: Store<Color>

  /**
   * @param options - Backend, initial spaces and clear color.
   * @throws {@link Error} If space identifiers are duplicated.
   */
  public constructor({
    backend,
    spaces = [],
    passes = [],
    clearColor = Color.black,
  }: RendererModuleOptions) {
    super({ identifier: 'org.js.fable.RendererModule' })
    this.backend = backend
    this.clearColor = new Store(clearColor)
    this._passes.add(new ClearRenderPass())
    this._passes.add(new SpaceRenderPass())
    for (const space of spaces) this._spaces.add(space)
    for (const pass of passes) this._passes.add(pass)
  }

  /** Spaces indexed by identifier. The module retains ownership. */
  public get spaces(): ReadonlyMap<string, RenderSpace> {
    const spaces = new Map<string, RenderSpace>()
    for (const space of this._spaces) spaces.set(space.identifier, space)
    return spaces
  }

  /** Passes indexed by identifier. The module retains ownership. */
  public get passes(): ReadonlyMap<string, RenderPass> {
    const passes = new Map<string, RenderPass>()
    for (const pass of this._passes) passes.set(pass.identifier, pass)
    return passes
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

  /**
   * Registers a pass, transferring its ownership to the module.
   *
   * @param pass - Pass to register.
   * @throws {@link Error} If the pass is destroyed or its identifier is duplicated.
   */
  public addPass(pass: RenderPass): void {
    this.throwIfDestroyed()
    this._passes.add(pass)
  }

  /**
   * Removes a pass and returns its ownership to the caller.
   *
   * @param identifier - Identifier of the pass to remove.
   * @returns The removed pass, or undefined when it is not registered.
   */
  public removePass(identifier: string): RenderPass | undefined {
    this.throwIfDestroyed()
    const pass = this._passes.get(identifier)
    if (pass === undefined) return undefined
    this._passes.delete(pass)
    return pass
  }

  /** @inheritDoc */
  public update(context: UpdateContext): void {
    this.render(context.deltaTime)
  }

  /**
   * Draws the registered spaces through the pipeline passes.
   *
   * Passes run in priority order inside a single frame; the built-in passes
   * clear every surface once and draw the spaces in priority order. Failed
   * drawing still ends the active frame.
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
        const spaces = [...this._spaces].sort((left, right) => left.priority - right.priority)
        const context: RenderPassContext = {
          backend,
          deltaTime,
          clearColor: this.clearColor.value,
          spaces,
        }
        const passes = [...this._passes].sort((left, right) => left.priority - right.priority)
        for (const pass of passes) pass.execute(context)
      } finally {
        backend.endFrame()
      }
    } finally {
      this._rendering = false
    }
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

  protected override onDestroy(): void {
    if (!this.state.destroyed && this.state.value !== ModuleState.idle) {
      throw new Error(`Module '${this.identifier}' cannot be destroyed while not idle.`)
    }

    for (const pass of [...this._passes]) {
      if (!pass.destroyed) pass.destroy()
    }

    this._passes.clear()
    for (const space of [...this._spaces]) {
      if (!space.destroyed) space.destroy()
    }

    this._spaces.clear()
    if (!this.clearColor.destroyed) this.clearColor.destroy()
    if (!this.backend.destroyed) this.backend.destroy()
    super.onDestroy()
  }
}
