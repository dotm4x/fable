import { describe, expect, expectTypeOf, it, vi } from 'vitest';

import { EventConnection, type ReadOnlySignal, Signal } from '../../source/index.js';

describe('Signal', () => {
  it('exposes subscriptions without mutation methods through its read-only interface', () => {
    expectTypeOf<keyof ReadOnlySignal<number>>().toEqualTypeOf<'connect' | 'destroyed'>();

    const signal = new Signal<number>();
    const readOnly: ReadOnlySignal<number> = signal;
    const callback = vi.fn();
    const connection = readOnly.connect(callback);

    signal.fire(1);
    expect(callback).toHaveBeenCalledWith(1);
    connection.disconnect();
    signal.fire(2);
    expect(callback).toHaveBeenCalledOnce();
  });

  it('fires a single payload to persistent connections', () => {
    const event = new Signal<{ value: number }>();
    const callback = vi.fn();
    const connection = event.connect(callback);

    event.fire({ value: 1 });
    event.fire({ value: 2 });

    expect(callback).toHaveBeenNthCalledWith(1, { value: 1 });
    expect(callback).toHaveBeenNthCalledWith(2, { value: 2 });
    expect(connection).toBeInstanceOf(EventConnection);
    expect(connection.connected).toBe(true);
    expect(connection.persistent).toBe(true);
  });

  it('fires multiple arguments with optional tuple arguments', () => {
    const event = new Signal<[number, string?]>();
    const callback = vi.fn();
    event.connect(callback);

    event.fire(1);
    event.fire(2, 'two');

    expect(callback).toHaveBeenNthCalledWith(1, 1);
    expect(callback).toHaveBeenNthCalledWith(2, 2, 'two');
  });

  it('disconnects non-persistent connections after the first fire', () => {
    const event = new Signal<number>();
    const callback = vi.fn();
    const connection = event.connect(callback, false);

    event.fire(1);
    event.fire(2);

    expect(callback).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledWith(1);
    expect(connection.connected).toBe(false);
  });

  it('disconnects callbacks explicitly and when the event is destroyed', () => {
    const event = new Signal<number>();
    const disconnectedCallback = vi.fn();
    const ownedCallback = vi.fn();
    const connection = event.connect(disconnectedCallback);
    const ownedConnection = event.connect(ownedCallback);

    connection.disconnect();
    connection.disconnect();
    event.fire(1);
    expect(disconnectedCallback).not.toHaveBeenCalled();
    event.destroy();

    expect(ownedCallback).toHaveBeenCalledOnce();
    expect(ownedCallback).toHaveBeenCalledWith(1);
    expect(ownedConnection.connected).toBe(false);
    expect(() => {
      event.fire(2);
    }).toThrow(Error);
    expect(() => event.connect(vi.fn())).toThrow(Error);
  });

  it('clears all connections and remains usable', () => {
    const event = new Signal<number>();
    const firstCallback = vi.fn();
    const secondCallback = vi.fn();
    const firstConnection = event.connect(firstCallback);
    const secondConnection = event.connect(secondCallback);

    event.clear();
    event.fire(1);

    expect(firstConnection.connected).toBe(false);
    expect(secondConnection.connected).toBe(false);
    expect(firstCallback).not.toHaveBeenCalled();
    expect(secondCallback).not.toHaveBeenCalled();

    const nextCallback = vi.fn();
    event.connect(nextCallback);
    event.fire(2);

    expect(nextCallback).toHaveBeenCalledWith(2);
  });

  it('fires without arguments by default', () => {
    const event = new Signal();
    const callback = vi.fn();
    event.connect(callback);

    event.fire();

    expect(callback).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledWith();
  });
});
