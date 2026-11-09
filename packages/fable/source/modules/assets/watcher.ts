import { type ReadOnlySignal, Signal } from '#/core/events/signal.js'
import { Destroyable } from '#/core/primitives/destroyable.js'

/**
 * Receives source change notifications from development tooling.
 *
 * Browsers cannot watch arbitrary filesystem paths, so the importers do not
 * poll sources. Development tooling notifies this watcher instead, and the
 * assets module reimports the assets loaded from the reported source.
 *
 * The watcher is independent from fetching and importing.
 */
export class SourceWatcher extends Destroyable {
  private readonly _onChange: Signal<[source: string]> = new Signal<[source: string]>()

  /** Fired with the source reported as changed. */
  public readonly onChange: ReadOnlySignal<[source: string]> = this._onChange

  /**
   * Reports that a source changed.
   *
   * @param source - Source passed to previous loads that must be reimported.
   * @throws {@link Error} If this watcher is destroyed or the source is empty.
   */
  public notify(source: string): void {
    this.throwIfDestroyed()
    if (!source.trim()) {
      throw new Error('Watched source must not be empty.')
    }

    this._onChange.fire(source)
  }

  protected override onDestroy(): void {
    if (!this._onChange.destroyed) this._onChange.destroy()
  }
}
