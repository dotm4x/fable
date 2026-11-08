import { type ReadOnlySignal, Signal } from '../events/signal.js';
import { type Identifiable } from '../interfaces/identifiable.js';

/**
 * A reactive collection of objects indexed by their identifiers.
 *
 * Identifiers must remain unchanged while their objects are in the collection.
 * Identifier equality follows the native Map's SameValueZero semantics.
 * Initial values do not produce notifications.
 *
 * @typeParam TValue - The identifiable object type.
 */
export class IdentifiableSet<TValue extends Identifiable<unknown>> implements Iterable<TValue> {
  private readonly _entries: Map<TValue['identifier'], TValue> = new Map<
    TValue['identifier'],
    TValue
  >();

  private readonly _onAdd: Signal<[value: TValue]> = new Signal<[value: TValue]>();
  private readonly _onDelete: Signal<[value: TValue]> = new Signal<[value: TValue]>();

  /** Fired with the object added to the collection. */
  public readonly onAdd: ReadOnlySignal<[value: TValue]> = this._onAdd;

  /** Fired with the object removed from the collection. */
  public readonly onDelete: ReadOnlySignal<[value: TValue]> = this._onDelete;

  /**
   * Creates a collection from identifiable objects.
   *
   * @param values - Initial objects to index.
   * @throws {@link Error} If multiple objects have the same identifier.
   */
  public constructor(values?: Iterable<TValue> | null) {
    if (values) {
      for (const value of values) {
        this.add(value);
      }
    }
  }

  /** The number of objects in the collection. */
  public get size(): number {
    return this._entries.size;
  }

  /**
   * Adds an object indexed by its identifier.
   *
   * @param value - The object to add.
   * @returns This collection.
   * @throws {@link Error} If the identifier is already present.
   */
  public add(value: TValue): this {
    if (this._entries.has(value.identifier)) {
      throw new Error('An object with this identifier already exists.');
    }

    this._entries.set(value.identifier, value);
    this._onAdd.fire(value);
    return this;
  }

  /**
   * Returns the object indexed by an identifier.
   *
   * @param identifier - The identifier to look up.
   * @returns The object, or `undefined` if it is absent.
   */
  public get(identifier: TValue['identifier']): TValue | undefined {
    return this._entries.get(identifier);
  }

  /**
   * Checks whether an object's identifier is present.
   *
   * @param value - An object with the identifier to look up.
   * @returns Whether the identifier is present.
   */
  public has(value: TValue): boolean {
    return this._entries.has(value.identifier);
  }

  /**
   * Removes the stored object with the given object's identifier.
   *
   * @param value - An object with the identifier to remove.
   * @returns Whether an object was removed.
   */
  public delete(value: TValue): boolean {
    const stored = this._entries.get(value.identifier);
    if (stored === undefined) {
      return false;
    }

    this._entries.delete(value.identifier);
    this._onDelete.fire(stored);
    return true;
  }

  /**
   * Removes all objects and notifies listeners for each removed object.
   *
   * All objects are removed before callbacks run. If a callback throws,
   * subsequent notifications are not delivered.
   */
  public clear(): void {
    const values = [...this._entries.values()];
    this._entries.clear();
    for (const value of values) {
      this._onDelete.fire(value);
    }
  }

  /**
   * Returns an iterator over objects in insertion order.
   *
   * @returns An iterator over the stored objects.
   */
  public values(): IterableIterator<TValue> {
    return this._entries.values();
  }

  /** @inheritDoc */
  public [Symbol.iterator](): IterableIterator<TValue> {
    return this.values();
  }
}
