import { type ReadOnlySignal, Signal } from '../events/signal.js'

/**
 * A Map that emits signals when its entries change.
 *
 * Initial entries do not produce notifications. Mutations happen before
 * notifications, and callback errors propagate to the caller.
 *
 * @typeParam TKey - The type of keys in the map.
 * @typeParam TValue - The type of values in the map.
 */
export class ReactiveMap<TKey, TValue> extends Map<TKey, TValue> {
  private readonly _onAdd: Signal<[key: TKey, value: TValue]> = new Signal<
    [key: TKey, value: TValue]
  >()

  private readonly _onDelete: Signal<[key: TKey, value: TValue]> = new Signal<
    [key: TKey, value: TValue]
  >()

  private readonly _onUpdate: Signal<[key: TKey, value: TValue, previous: TValue]> = new Signal<
    [key: TKey, value: TValue, previous: TValue]
  >()

  /** Fired with the key and value of a new entry. */
  public readonly onAdd: ReadOnlySignal<[key: TKey, value: TValue]> = this._onAdd

  /** Fired with the key and value of a removed entry. */
  public readonly onDelete: ReadOnlySignal<[key: TKey, value: TValue]> = this._onDelete

  /** Fired with the key, new value, and previous value of an updated entry. */
  public readonly onUpdate: ReadOnlySignal<[key: TKey, value: TValue, previous: TValue]> =
    this._onUpdate

  public constructor(entries?: Iterable<readonly [TKey, TValue]> | null) {
    super()
    if (entries) {
      for (const [key, value] of entries) {
        super.set(key, value)
      }
    }
  }

  /**
   * Sets an entry and emits `onAdd` or `onUpdate` when it changes.
   *
   * Existing values are compared with `Object.is`.
   *
   * @param key - The key to set.
   * @param value - The value to associate with the key.
   * @returns This map.
   */
  public override set(key: TKey, value: TValue): this {
    if (!this.has(key)) {
      super.set(key, value)
      this._onAdd.fire(key, value)
      return this
    }

    const previous = super.get(key) as TValue
    if (!Object.is(previous, value)) {
      super.set(key, value)
      this._onUpdate.fire(key, value, previous)
    }

    return this
  }

  /**
   * Deletes an entry and emits `onDelete` if it was present.
   *
   * @param key - The key to delete.
   * @returns Whether the key was present.
   */
  public override delete(key: TKey): boolean {
    if (!this.has(key)) {
      return false
    }

    const value = super.get(key) as TValue
    super.delete(key)
    this._onDelete.fire(key, value)
    return true
  }

  /**
   * Removes all entries and emits `onDelete` for each removed entry.
   *
   * All entries are removed before callbacks run. If a callback throws,
   * subsequent notifications are not delivered.
   */
  public override clear(): void {
    const entries = [...this]
    super.clear()
    for (const [key, value] of entries) {
      this._onDelete.fire(key, value)
    }
  }
}
