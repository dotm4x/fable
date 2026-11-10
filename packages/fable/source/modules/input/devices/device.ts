import { Destroyable } from '#/core/primitives/destroyable.js'

/** A device owned by an input module and attached to its borrowed element. */
export abstract class InputDevice extends Destroyable {
  private _active: boolean = false

  public constructor(public readonly identifier: string) {
    super()
  }

  /** Whether the device is attached to its input element. */
  public get active(): boolean {
    return this._active
  }

  /** @internal Called by the owning module. */
  public start(target: HTMLElement): void {
    this.throwIfDestroyed()
    if (this._active) throw new Error(`Input device '${this.identifier}' is already active.`)
    this._active = true
    this.onStart(target)
  }

  /** @internal Called by the owning module, including after a failed start. */
  public stop(): void {
    this.throwIfDestroyed()
    if (!this._active) return
    this.onStop()
    this._active = false
  }

  /** Attaches listeners or other resources to the borrowed element. */
  protected abstract onStart(target: HTMLElement): void

  /** Releases resources acquired by `onStart`, including after a failed start. */
  protected abstract onStop(): void

  protected override onDestroy(): void {
    if (this._active) throw new Error(`Input device '${this.identifier}' is active.`)
  }
}
