import { Event, type ReadOnlyEvent } from './event.js';

/** Describes a change to a store's value. */
export interface StoreChange<TValue> {
  /** The value before the change. */
  readonly previous: TValue;

  /** The value after the change. */
  readonly value: TValue;
}

/**
 * Provides read-only access to a store's value and change subscriptions.
 *
 * @typeParam TValue - The type of value held by the store.
 */
export interface ReadOnlyStore<TValue> extends ReadOnlyEvent<StoreChange<TValue>> {
  /** The current stored value. */
  readonly value: TValue;
}

/**
 * Stores a value and dispatches changes when it is updated.
 *
 * Change notifications are skipped when the previous value considers the
 * next value equal through `equals`, or when `Object.is` reports equality.
 *
 * @typeParam TValue - The type of value held by the store.
 */
export class Store<TValue> extends Event<StoreChange<TValue>> implements ReadOnlyStore<TValue> {
  private currentValue: TValue;

  public constructor(value: TValue) {
    super();
    this.currentValue = value;
  }

  /** Gets or updates the stored value. */
  public get value(): TValue {
    this.throwIfDestroyed();
    return this.currentValue;
  }

  public set value(nextValue: TValue) {
    this.throwIfDestroyed();

    const previous = this.currentValue;
    if (this.valueEquals(previous, nextValue)) {
      return;
    }

    this.currentValue = nextValue;
    this.dispatch({ previous, value: nextValue });
  }

  private hasEquals(value: TValue): value is TValue & {
    equals(other: TValue): boolean;
  } {
    return (
      typeof value === 'object' &&
      value !== null &&
      'equals' in value &&
      typeof value.equals === 'function'
    );
  }

  private valueEquals(previous: TValue, next: TValue): boolean {
    if (this.hasEquals(previous)) {
      return previous.equals(next);
    }

    return Object.is(previous, next);
  }
}
