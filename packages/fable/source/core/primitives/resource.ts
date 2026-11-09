import { type ReadOnlySignal, Signal } from '../events/signal.js'

import { Destroyable } from './destroyable.js'

/**
 * Represents reusable data that can be shared between objects.
 *
 * A resource is destroyed by its creator or by the owner to which it was transferred,
 * such as an importer. Objects using a shared resource borrow it and do not destroy it.
 *
 * Resources notify {@link onDestroyed} before they are marked as destroyed, which
 * lets caching layers release native copies of their contents.
 */
export abstract class Resource extends Destroyable {
  private readonly _onDestroyed: Signal<[resource: Resource]> = new Signal<[resource: Resource]>()

  /** Fired once when the resource is destroyed. */
  public readonly onDestroyed: ReadOnlySignal<[resource: Resource]> = this._onDestroyed

  protected override onDestroy(): void {
    this._onDestroyed.fire(this)
    if (!this._onDestroyed.destroyed) this._onDestroyed.destroy()
  }
}
