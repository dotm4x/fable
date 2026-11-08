import { type ReadOnlySignal, Signal } from '../events/signal.js';

/**
 * A Set that emits signals when its contents change.
 *
 * Initial values do not produce notifications. Mutations happen before
 * notifications, and callback errors propagate to the caller.
 *
 * @typeParam TValue - The type of values in the set.
 */
export class ReactiveSet<TValue> extends Set<TValue> {
  private readonly _onAdd: Signal<[value: TValue]> = new Signal<[value: TValue]>();
  private readonly _onDelete: Signal<[value: TValue]> = new Signal<[value: TValue]>();

  /** Fired with the value added to the set; consumers can subscribe but not emit. */
  public readonly onAdd: ReadOnlySignal<[value: TValue]> = this._onAdd;

  /** Fired with the value removed from the set; consumers can subscribe but not emit. */
  public readonly onDelete: ReadOnlySignal<[value: TValue]> = this._onDelete;

  public constructor(values?: Iterable<TValue> | null) {
    super();
    if (values) {
      for (const value of values) {
        super.add(value);
      }
    }
  }

  /**
   * Adds a value and emits `onAdd` if it was not already present.
   *
   * @param value - The value to add.
   * @returns This set.
   */
  public override add(value: TValue): this {
    if (!this.has(value)) {
      super.add(value);
      this._onAdd.fire(value);
    }

    return this;
  }

  /**
   * Deletes a value and emits `onDelete` if it was present.
   *
   * @param value - The value to delete.
   * @returns Whether the value was present.
   */
  public override delete(value: TValue): boolean {
    if (!super.delete(value)) {
      return false;
    }

    this._onDelete.fire(value);
    return true;
  }

  /**
   * Removes all values and emits `onDelete` for each removed value.
   *
   * All values are removed before callbacks run. If a callback throws,
   * subsequent notifications are not delivered.
   */
  public override clear(): void {
    const values = [...this];
    super.clear();
    for (const value of values) {
      this._onDelete.fire(value);
    }
  }
}
