import { Signal } from '@core/events/signal.js'
import { Store } from '@core/events/store.js'

/** Configuration for a named, rebindable input action. */
export interface InputEventOptions<TSource> {
  /** Stable action identifier. */
  readonly identifier: string
  /** Browser input source that activates the action. */
  readonly source: TSource
}

/** A signal bound to a mutable input source. */
export class InputEvent<TPayload, TSource> extends Signal<TPayload> {
  /** Stable action identifier. */
  public readonly identifier: string
  /** Source used to match browser events; can be changed to rebind the action. */
  public readonly source: Store<TSource>

  public constructor({ identifier, source }: InputEventOptions<TSource>) {
    super()
    this.identifier = identifier
    this.source = new Store(source)
  }

  protected override onDestroy(): void {
    if (!this.source.destroyed) this.source.destroy()
    super.onDestroy()
  }
}
