import { type ReadOnlySignal, Signal } from '#/core/events/signal.js'
import { type StoreChange } from '#/core/events/store.js'
import { type Identifiable } from '#/core/interfaces/identifiable.js'
import { Resource } from '#/core/primitives/resource.js'

/** Configuration for an asset. */
export interface AssetOptions<TValue> {
  /** Stable identifier, normally the source that produced the asset. */
  readonly identifier: string
  /** Loaded value shared by consumers. */
  readonly value: TValue
  /** Releases the value when the asset is destroyed. */
  readonly release?: () => void
}

const replaceKey: unique symbol = Symbol('Asset.replace')

/**
 * A loaded value shared between consumers.
 *
 * The assets module creates and owns assets; consumers borrow them. Destroying
 * an asset invokes its release callback once. Hot reload replaces the value in
 * place, keeping the asset identity and notifying {@link onChange} before the
 * previous value is released.
 *
 * @typeParam TValue - The type of the loaded value.
 */
export class Asset<TValue = unknown> extends Resource implements Identifiable<string> {
  private readonly _onChange: Signal<StoreChange<TValue>> = new Signal<StoreChange<TValue>>()
  private _value: TValue
  private _release: () => void

  /** Stable identifier of the asset. */
  public readonly identifier: string

  /** Fired after a hot reload replaces the value and before releasing the previous one. */
  public readonly onChange: ReadOnlySignal<StoreChange<TValue>> = this._onChange

  /**
   * @param options - Asset identifier, value and optional release callback.
   */
  public constructor({ identifier, value, release }: AssetOptions<TValue>) {
    super()
    this.identifier = identifier
    this._value = value
    this._release = release ?? (() => undefined)
  }

  /** Loaded value shared by consumers. */
  public get value(): TValue {
    return this._value
  }

  /**
   * Replaces the value, notifying consumers and releasing the previous value.
   *
   * @internal Called by the owning assets module during hot reload.
   * @param value - The replacement value.
   * @param release - Releases the replacement value when the asset is destroyed.
   */
  public [replaceKey](value: TValue, release: (() => void) | undefined): void {
    const previous = this._value
    const previousRelease = this._release
    this._value = value
    this._release = release ?? (() => undefined)
    try {
      this._onChange.fire({ previous, value })
    } finally {
      previousRelease()
    }
  }

  protected override onDestroy(): void {
    if (!this._onChange.destroyed) this._onChange.destroy()
    this._release()
  }
}

/**
 * Replaces an asset value through its internal lifecycle.
 *
 * @internal Used by the assets module during hot reload.
 * @param asset - Asset to update.
 * @param value - The replacement value.
 * @param release - Releases the replacement value when the asset is destroyed.
 */
export function replaceAssetValue<TValue>(
  asset: Asset<TValue>,
  value: TValue,
  release: (() => void) | undefined,
): void {
  asset[replaceKey](value, release)
}
