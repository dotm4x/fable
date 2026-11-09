import { type Identifiable } from '#/core/interfaces/identifiable.js'
import { Destroyable } from '#/core/primitives/destroyable.js'
import { ClearCommand } from '#/graphics/commands/clear.js'
import { type DrawCommand } from '#/graphics/commands/command.js'
import { type DrawContext } from '#/graphics/interfaces/context.js'
import { type Viewport } from '#/graphics/primitives/viewport.js'
import { type GraphicMaterial } from '#/graphics/resources/material.js'
import { type RenderTarget } from '#/graphics/resources/targets/target.js'
import { type TextureBinding } from '#/graphics/resources/textures/binding.js'

/**
 * Executes backend-independent drawing commands within explicit frames.
 *
 * Backends are owned by the renderer, which never destroys them while a frame
 * is active. Each frame starts with {@link beginFrame}, receives one or more
 * {@link render} calls, and always ends with {@link endFrame}.
 */
export abstract class RenderBackend extends Destroyable implements Identifiable<string> {
  private _frameActive: boolean = false

  /** Unique backend identifier. */
  public readonly identifier: string

  /**
   * @param identifier - The nonempty backend identifier.
   * @throws {@link Error} If the identifier is empty.
   */
  protected constructor(identifier: string) {
    super()
    if (!identifier.trim()) {
      throw new Error('Render backend identifier must not be empty.')
    }
    this.identifier = identifier
  }

  /**
   * Default material of the standard two-dimensional pipeline.
   *
   * The backend owns it and destroys it with the backend.
   */
  public abstract readonly defaultMaterial: GraphicMaterial

  /**
   * Creates a material for the standard two-dimensional pipeline.
   *
   * The returned material borrows this backend's shaders and is owned by the
   * caller.
   *
   * @param textures - Optional texture bindings consumed by the material.
   * @returns A material compatible with this backend.
   */
  public abstract createMaterial(textures?: Iterable<TextureBinding>): GraphicMaterial

  /** Size of the drawing surface in physical pixels. */
  public abstract get viewport(): Viewport

  /** Acquires the resources needed to begin a frame. */
  protected abstract onBeginFrame(): void

  /** Finishes and presents the active frame. */
  protected abstract onEndFrame(): void

  /**
   * Executes commands in order on a drawing destination.
   *
   * Clear commands need no context; drawing commands require the context of the
   * space that produced them. The target is borrowed and is not owned by the
   * backend.
   */
  protected abstract onRender(
    commands: readonly DrawCommand[],
    context: DrawContext | undefined,
    target: RenderTarget | undefined,
  ): void

  /**
   * Begins a frame.
   *
   * @throws {@link Error} If the backend is destroyed or a frame is already active.
   */
  public beginFrame(): void {
    this.throwIfDestroyed()
    if (this._frameActive) {
      throw new Error('A drawing frame is already active.')
    }
    this.onBeginFrame()
    this._frameActive = true
  }

  /** Ends the current frame, if one is active. */
  public endFrame(): void {
    this.throwIfDestroyed()
    if (!this._frameActive) return
    try {
      this.onEndFrame()
    } finally {
      this._frameActive = false
    }
  }

  /**
   * Executes commands inside the active frame.
   *
   * @param commands - The commands to execute, in order.
   * @param context - The camera and viewport context, or undefined for context-free commands.
   * @param target - The offscreen target, or undefined to draw to the window.
   * @throws {@link Error} If the backend is destroyed, no frame is active, a
   * drawing command is rendered without a context, or the target is destroyed.
   */
  public render(
    commands: Iterable<DrawCommand>,
    context?: DrawContext,
    target?: RenderTarget,
  ): void {
    this.throwIfDestroyed()
    if (!this._frameActive) {
      throw new Error('A drawing frame must be active before rendering.')
    }
    if (target?.destroyed === true) {
      throw new Error('The drawing target is destroyed.')
    }
    const list = [...commands]
    if (context === undefined && list.some((command) => !(command instanceof ClearCommand))) {
      throw new Error('Drawing commands require a drawing context.')
    }

    this.onRender(list, context, target)
  }
}
