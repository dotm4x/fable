import { Destroyable, type ReadOnlyDestroyable } from '../primitives/destroyable.js';

export type EventArguments<TPayload> = [TPayload] extends [undefined]
  ? []
  : TPayload extends readonly unknown[]
    ? TPayload
    : [payload: TPayload];

/** Provides read-only access to the state of an event connection. */
export interface ReadOnlyEventConnection extends ReadOnlyDestroyable {
  /** Whether this connection remains active after the event fires. */
  readonly persistent: boolean;

  /** Whether this connection is still active. */
  readonly connected: boolean;
}

/**
 * Provides access to an event's state and subscriptions without exposing
 * dispatch, bulk disconnection, or destruction.
 *
 * @typeParam TPayload - The payload type or a tuple of callback arguments.
 */
export interface ReadOnlyEvent<TPayload = undefined> extends ReadOnlyDestroyable {
  /**
   * Connects a callback to this event.
   *
   * @param callback - The callback to invoke when this event dispatches.
   * @param persistent - Whether the callback remains connected after dispatch.
   * @returns A connection that can be used to disconnect the callback.
   * @throws {@link Error} If this event has been destroyed.
   */
  connect(
    callback: (...payload: EventArguments<TPayload>) => void,
    persistent?: boolean,
  ): EventConnection;
}

/**
 * A handle to a callback registered with an {@link Event}.
 */
export class EventConnection extends Destroyable implements ReadOnlyEventConnection {
  /**
   * Creates a connection for an event callback.
   *
   * @param persistent - Whether the connection remains active after the event fires.
   * @param _onDisconnect - Removes the connection from its event.
   */
  public constructor(
    public readonly persistent: boolean,
    private readonly _onDisconnect: (connection: EventConnection) => void,
  ) {
    super();
  }

  /** Whether this connection is still active. */
  public get connected(): boolean {
    return !this.destroyed;
  }

  /**
   * Disconnects this callback from its event.
   *
   * Calling this method more than once has no effect.
   */
  public disconnect(): void {
    if (!this.destroyed) {
      this.destroy();
    }
  }

  protected override onDestroy(): void {
    this._onDisconnect(this);
  }
}

/**
 * A destroyable base for objects that notify connected callbacks.
 *
 * Subclasses control when callbacks are dispatched.
 *
 * @typeParam TPayload - The payload type or a tuple of callback arguments.
 */
export abstract class Event<TPayload = undefined>
  extends Destroyable
  implements ReadOnlyEvent<TPayload>
{
  private readonly _connections: Map<
    EventConnection,
    (...payload: EventArguments<TPayload>) => void
  > = new Map<EventConnection, (...payload: EventArguments<TPayload>) => void>();

  /**
   * Connects a callback to this event.
   *
   * Persistent connections remain active after dispatch. Non-persistent
   * connections are disconnected before their first callback invocation.
   *
   * @param callback - The callback to invoke when this event dispatches.
   * @param persistent - Whether the callback remains connected after dispatch.
   * @returns A connection that can be used to disconnect the callback.
   * @throws {@link Error} If this event has been destroyed.
   */
  public connect(
    callback: (...payload: EventArguments<TPayload>) => void,
    persistent: boolean = true,
  ): EventConnection {
    this.throwIfDestroyed();

    const connection = new EventConnection(persistent, (disconnected) => {
      this._connections.delete(disconnected);
    });
    this._connections.set(connection, callback);
    return connection;
  }

  /**
   * Disconnects all callbacks currently connected to this event.
   *
   * @throws {@link Error} If this event has been destroyed.
   */
  public clear(): void {
    this.throwIfDestroyed();

    for (const connection of [...this._connections.keys()]) {
      connection.disconnect();
    }
  }

  /**
   * Invokes callbacks connected to this event.
   *
   * @param payload - The payload or arguments passed to connected callbacks.
   * @throws {@link Error} If this event has been destroyed.
   */
  protected dispatch(...payload: EventArguments<TPayload>): void {
    this.throwIfDestroyed();

    for (const [connection, callback] of [...this._connections]) {
      if (!connection.connected) {
        continue;
      }

      if (!connection.persistent) {
        connection.disconnect();
      }

      callback(...payload);
    }
  }

  protected override onDestroy(): void {
    this.clear();
  }
}
