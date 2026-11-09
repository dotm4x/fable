import { Destroyable } from '../primitives/destroyable.js'

import { Event, type EventArguments, type EventConnection, type ReadOnlyEvent } from './event.js'

/**
 * Provides access to a signal's state and subscriptions without exposing emission.
 *
 * @typeParam TPayload - The payload type or a tuple of callback arguments.
 */
export interface ReadOnlySignal<TPayload = undefined> extends ReadOnlyEvent<TPayload> {
  /** @inheritDoc */
  connect(
    callback: (...payload: EventArguments<TPayload>) => void,
    persistent?: boolean,
  ): EventConnection
}

class SignalEvent<TPayload> extends Event<TPayload> {
  public fire(...payload: EventArguments<TPayload>): void {
    this.dispatch(...payload)
  }
}

/**
 * A signal that exposes event connections and an explicit fire operation.
 *
 * Use a tuple as the payload type to define multiple arguments, including
 * optional arguments, for example `Signal<[number, string?]>`.
 *
 * @typeParam TPayload - The payload type or a tuple of callback arguments.
 */
export class Signal<TPayload = undefined> extends Destroyable implements ReadOnlySignal<TPayload> {
  private readonly _event: SignalEvent<TPayload> = new SignalEvent<TPayload>()

  /**
   * Connects a callback to this signal.
   *
   * @param callback - The callback to invoke when this signal fires.
   * @param persistent - Whether the callback remains connected after firing.
   * @returns A connection that can be used to disconnect the callback.
   * @throws {@link Error} If this signal has been destroyed.
   */
  public connect(
    callback: (...payload: EventArguments<TPayload>) => void,
    persistent: boolean = true,
  ): EventConnection {
    this.throwIfDestroyed()
    return this._event.connect(callback, persistent)
  }

  /**
   * Disconnects all callbacks currently connected to this signal.
   *
   * @throws {@link Error} If this signal has been destroyed.
   */
  public clear(): void {
    this.throwIfDestroyed()
    this._event.clear()
  }

  /**
   * Invokes callbacks connected to this signal.
   *
   * @param payload - The payload or arguments passed to connected callbacks.
   * @throws {@link Error} If this signal has been destroyed.
   */
  public fire(...payload: EventArguments<TPayload>): void {
    this.throwIfDestroyed()
    this._event.fire(...payload)
  }

  protected override onDestroy(): void {
    this._event.destroy()
  }
}
