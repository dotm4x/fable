import { IdentifiableSet } from '#/core/collections/identifiable-set.js'
import { Once } from '#/core/primitives/once.js'

import { InputDevice } from '../device.js'

import { type KeyboardEventPayload, type KeyboardInputEvent } from './event.js'

/** Keyboard actions owned by an input module. */
export class Keyboard extends InputDevice {
  private readonly _preparation: Once = new Once('Keyboard preparation failed or is in progress.')
  private _target: HTMLElement | undefined
  private readonly keyDown: (event: KeyboardEvent) => void = (event) => {
    this.handle(event, true)
  }
  private readonly keyUp: (event: KeyboardEvent) => void = (event) => {
    this.handle(event, false)
  }
  /** Adding an action transfers ownership; removing it returns ownership. */
  public readonly events: IdentifiableSet<KeyboardInputEvent>

  public constructor(events: Iterable<KeyboardInputEvent> = []) {
    super('Keyboard')
    this.events = new IdentifiableSet(events)
  }

  /** Yields actions whose ownership transfers to this keyboard. */
  protected *compose(): Generator<KeyboardInputEvent, void, unknown> {
    // Override to yield actions.
  }

  /** Configures actions once after composition. */
  protected configure(): void {
    // Override to configure actions.
  }

  protected override onStart(target: HTMLElement): void {
    this._preparation.execute(() => {
      for (const action of this.compose()) {
        try {
          this.events.add(action)
        } catch (error) {
          if (this.events.get(action.identifier) !== action && !action.destroyed) {
            try {
              action.destroy()
            } catch (failure) {
              throw new AggregateError([error, failure], 'Keyboard action cleanup failed.', {
                cause: failure,
              })
            }
          }
          throw error
        }
      }
      this.configure()
    })
    this._target = target
    target.addEventListener('keydown', this.keyDown)
    target.addEventListener('keyup', this.keyUp)
  }

  protected override onStop(): void {
    this._target?.removeEventListener('keydown', this.keyDown)
    this._target?.removeEventListener('keyup', this.keyUp)
    this._target = undefined
  }

  /** @internal Publishes a browser keyboard transition. */
  public handle(event: KeyboardEvent, down: boolean): void {
    this.throwIfDestroyed()
    for (const action of [...this.events]) {
      if (this.events.get(action.identifier) !== action) continue
      const key = action.source.value
      if (key === event.code) {
        const payload: KeyboardEventPayload = { key, down, repeat: event.repeat }
        action.fire(payload)
      }
    }
  }

  protected override onDestroy(): void {
    super.onDestroy()
    for (const action of this.events) {
      if (!action.destroyed) action.destroy()
    }
    this.events.clear()
  }
}
