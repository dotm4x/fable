import { Destroyable } from '../primitives/destroyable.js';

type EventArguments<TPayload> = [TPayload] extends [undefined]
  ? []
  : TPayload extends readonly unknown[]
    ? TPayload
    : [payload: TPayload];

/**
 * A handle to a callback registered with an {@link Event}.
 */
export class EventConnection extends Destroyable {
  /**
   * Creates a connection for an event callback.
   *
   * @param persistent - Whether the connection remains active after the event fires.
   * @param onDisconnect - Removes the connection from its event.
   */
  public constructor(
    public readonly persistent: boolean,
    private readonly onDisconnect: (connection: EventConnection) => void,
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
    this.onDisconnect(this);
  }
}

/**
 * A destroyable base for objects that notify connected callbacks.
 *
 * Subclasses control when callbacks are dispatched.
 *
 * @typeParam TPayload - The payload type or a tuple of callback arguments.
 */
export abstract class Event<TPayload = undefined> extends Destroyable {
  private readonly connections: Map<
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
      this.connections.delete(disconnected);
    });
    this.connections.set(connection, callback);
    return connection;
  }

  /**
   * Disconnects all callbacks currently connected to this event.
   *
   * @throws {@link Error} If this event has been destroyed.
   */
  public clear(): void {
    this.throwIfDestroyed();

    for (const connection of [...this.connections.keys()]) {
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

    for (const [connection, callback] of [...this.connections]) {
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
