import { type EventConnection } from '#/core/events/event.js'
import { Module, ModuleState } from '#/core/module.js'
import { Once } from '#/core/primitives/once.js'

import { type AssetImporter } from './importer.js'
import { Asset, replaceAssetValue } from './importers/resources/asset.js'
import { SourceWatcher } from './watcher.js'

/** Options for loading an asset. */
export interface AssetLoadOptions {
  /** Cache key; defaults to the source. */
  readonly key?: string
  /** Importer identifier; defaults to the importer registered for the source extension. */
  readonly type?: string
}

/** Configuration for the assets module. */
export interface AssetsModuleOptions {
  /** Initial importers whose ownership transfers to the module. */
  readonly importers?: Iterable<AssetImporter>
}

interface AssetLoad {
  readonly promise: Promise<Asset>
  readonly controller: AbortController
}

interface LoadedAsset {
  readonly asset: Asset
  readonly importer: AssetImporter
}

interface AssetReload {
  readonly promise: Promise<void>
  readonly controller: AbortController
}

/**
 * Loads, caches, reloads and releases assets through registered importers.
 *
 * Loaded assets are owned by the module until they are unloaded or the module
 * is destroyed. Concurrent loads of the same key share one pending request.
 * Assets survive stopping and restarting the owning game.
 *
 * Hot reload reimports loaded sources reported to {@link watcher}, replacing
 * asset values in place. Failed reloads keep the previous value.
 */
export class AssetsModule extends Module {
  private readonly _preparation: Once = new Once(
    'Assets module preparation has already failed or is in progress.',
  )

  private readonly _importers: Map<string, AssetImporter> = new Map<string, AssetImporter>()
  private readonly _extensions: Map<string, AssetImporter> = new Map<string, AssetImporter>()
  private readonly _pending: Map<string, AssetLoad> = new Map<string, AssetLoad>()
  private readonly _loaded: Map<string, LoadedAsset> = new Map<string, LoadedAsset>()
  private readonly _reloads: Map<string, AssetReload> = new Map<string, AssetReload>()
  private readonly _watching: EventConnection

  /** Watcher that development tooling notifies when a source changes. */
  public readonly watcher: SourceWatcher

  /**
   * @param options - Initial importers whose ownership transfers to the module.
   * @throws {@link Error} If an importer is destroyed or repeats an identifier or extension.
   */
  public constructor({ importers = [] }: AssetsModuleOptions = {}) {
    super({ identifier: 'org.js.fable.AssetsModule' })
    const declared = [...importers]
    const identifiers = new Set<string>()
    const extensions = new Set<string>()
    for (const importer of declared) {
      this.validateImporter(importer, identifiers, extensions)
    }

    for (const importer of declared) {
      this.attachImporter(importer)
    }

    this.watcher = new SourceWatcher()
    this._watching = this.watcher.onChange.connect((source) => {
      if (this.destroyed) return
      this.reload(source).catch(() => undefined)
    })
  }

  /** Importers indexed by identifier. The module retains ownership. */
  public get importers(): ReadonlyMap<string, AssetImporter> {
    return new Map(this._importers)
  }

  /** Loaded assets indexed by cache key. The module retains ownership. */
  public get assets(): ReadonlyMap<string, Asset> {
    const assets = new Map<string, Asset>()
    for (const [key, loaded] of this._loaded) {
      assets.set(key, loaded.asset)
    }

    return assets
  }

  /**
   * Registers an importer, transferring its ownership to the module.
   *
   * @param importer - Importer to register.
   * @throws {@link Error} If the importer is destroyed or its identifier or
   * an extension is already registered.
   */
  public register(importer: AssetImporter): void {
    this.throwIfDestroyed()
    const identifiers = new Set(this._importers.keys())
    const extensions = new Set(this._extensions.keys())
    this.validateImporter(importer, identifiers, extensions)
    this.attachImporter(importer)
  }

  /**
   * Loads an asset, reusing a cached asset or a pending request for the key.
   *
   * The module creates and owns the asset, using the source as its identifier
   * even when a custom key is used. A failed load is released from the cache
   * and can be retried.
   *
   * @param source - Source passed to the selected importer.
   * @param options - Optional cache key and importer identifier.
   * @returns A promise for the asset owned by this module.
   * @throws {@link Error} If the module is destroyed, the key is empty, or no
   * importer matches the source.
   */
  public load<TValue = unknown>(
    source: string,
    options: AssetLoadOptions = {},
  ): Promise<Asset<TValue>> {
    this.throwIfDestroyed()
    const key = options.key ?? source
    if (!key.trim()) {
      throw new Error('Asset key must not be empty.')
    }

    const pending = this._pending.get(key)
    if (pending !== undefined) {
      return pending.promise as Promise<Asset<TValue>>
    }

    const loaded = this._loaded.get(key)
    if (loaded !== undefined) {
      return Promise.resolve(loaded.asset as Asset<TValue>)
    }

    const importer = this.resolveImporter(source, options.type)
    const controller = new AbortController()
    const promise = importer.load(source, controller.signal).then(
      (imported) => {
        const asset = new Asset({
          identifier: source,
          value: imported.value,
          ...(imported.release === undefined ? {} : { release: imported.release }),
        })
        if (this.destroyed || this._pending.get(key)?.promise !== promise) {
          if (!asset.destroyed) asset.destroy()
          throw new Error(`Asset '${key}' is no longer requested.`)
        }

        this._pending.delete(key)
        this._loaded.set(key, { asset, importer })
        return asset
      },
      (error: unknown) => {
        if (this._pending.get(key)?.promise === promise) this._pending.delete(key)
        throw error
      },
    )
    this._pending.set(key, { promise, controller })

    return promise as Promise<Asset<TValue>>
  }

  /**
   * Gets a loaded asset.
   *
   * @param key - Cache key of the asset.
   * @returns The loaded asset, or undefined when it is not loaded.
   */
  public get<TValue = unknown>(key: string): Asset<TValue> | undefined {
    this.throwIfDestroyed()

    return this._loaded.get(key)?.asset as Asset<TValue> | undefined
  }

  /**
   * Reimports every loaded asset whose source matches.
   *
   * Replacements keep the asset identity, notify its `onChange` signal and
   * release the previous value. Concurrent reloads of the same key share one
   * request, coalescing duplicate notifications. Failed reloads keep the
   * previous value and resolve without throwing.
   *
   * @param source - Source reported as changed.
   * @returns A promise that settles when matching reloads finish.
   * @throws {@link Error} If the module is destroyed or the source is empty.
   */
  public async reload(source: string): Promise<void> {
    this.throwIfDestroyed()
    if (!source.trim()) {
      throw new Error('Asset source must not be empty.')
    }

    const keys: string[] = []
    for (const [key, loaded] of this._loaded) {
      if (loaded.asset.identifier === source) keys.push(key)
    }

    await Promise.all(keys.map((key) => this.reloadAsset(key)))
  }

  /**
   * Releases an asset or cancels a pending load.
   *
   * A pending load or an in-flight reload is aborted and its promise rejects.
   * A loaded asset is destroyed, releasing its value.
   *
   * @param key - Cache key of the asset.
   * @returns Whether an asset or pending load was released.
   */
  public unload(key: string): boolean {
    this.throwIfDestroyed()
    const reload = this._reloads.get(key)
    if (reload !== undefined) {
      this._reloads.delete(key)
      reload.controller.abort()
    }

    const pending = this._pending.get(key)
    if (pending !== undefined) {
      this._pending.delete(key)
      pending.controller.abort()
      return true
    }

    const loaded = this._loaded.get(key)
    if (loaded === undefined) return false
    this._loaded.delete(key)
    loaded.asset.destroy()

    return true
  }

  /** Yields importers whose ownership transfers to the module. */
  protected *compose(): Generator<AssetImporter, void, unknown> {
    // Override to yield importers.
  }

  /** Configures the module once after composition. */
  protected configure(): void {
    // Override to configure the module.
  }

  protected override onStart(): void {
    this._preparation.execute(() => {
      for (const importer of this.compose()) {
        try {
          this.register(importer)
        } catch (error) {
          if (!this._importers.has(importer.identifier) && !importer.destroyed) {
            try {
              importer.destroy()
            } catch (failure) {
              throw new AggregateError([error, failure], 'Composed importer cleanup failed.', {
                cause: failure,
              })
            }
          }

          throw error
        }
      }

      this.configure()
    })
  }

  protected override onDestroy(): void {
    if (!this.state.destroyed && this.state.value !== ModuleState.idle) {
      throw new Error(`Module '${this.identifier}' cannot be destroyed while not idle.`)
    }

    this._watching.destroy()
    for (const reload of this._reloads.values()) {
      reload.controller.abort()
    }

    this._reloads.clear()
    for (const [key, pending] of this._pending) {
      this._pending.delete(key)
      pending.controller.abort()
    }

    for (const [key, loaded] of this._loaded) {
      this._loaded.delete(key)
      if (!loaded.asset.destroyed) loaded.asset.destroy()
    }

    for (const [identifier, importer] of this._importers) {
      this._importers.delete(identifier)
      if (!importer.destroyed) importer.destroy()
    }

    this._extensions.clear()
    if (!this.watcher.destroyed) this.watcher.destroy()
    super.onDestroy()
  }

  private reloadAsset(key: string): Promise<void> {
    const existing = this._reloads.get(key)
    if (existing !== undefined) return existing.promise

    const loaded = this._loaded.get(key)
    if (loaded === undefined) return Promise.resolve()

    const source = loaded.asset.identifier
    const controller = new AbortController()
    const promise = loaded.importer
      .load(source, controller.signal)
      .then(
        (imported) => {
          if (this.destroyed || this._loaded.get(key) !== loaded) {
            imported.release?.()
            return
          }

          replaceAssetValue(loaded.asset, imported.value, imported.release)
        },
        () => undefined,
      )
      .catch(() => undefined)
      .finally(() => {
        if (this._reloads.get(key)?.promise === promise) this._reloads.delete(key)
      })
    this._reloads.set(key, { promise, controller })

    return promise
  }

  private resolveImporter(source: string, type: string | undefined): AssetImporter {
    if (type !== undefined) {
      const importer = this._importers.get(type)
      if (importer === undefined) {
        throw new Error(`Asset importer '${type}' is not registered.`)
      }

      return importer
    }

    const extension = extensionOf(source)
    const importer = extension === undefined ? undefined : this._extensions.get(extension)
    if (importer === undefined) {
      throw new Error(`No asset importer is registered for '${source}'.`)
    }

    return importer
  }

  private validateImporter(
    importer: AssetImporter,
    identifiers: Set<string>,
    extensions: Set<string>,
  ): void {
    this.throwIfDestroyed()
    if (importer.destroyed) {
      throw new Error(`Asset importer '${importer.identifier}' is destroyed.`)
    }

    if (identifiers.has(importer.identifier)) {
      throw new Error(`Duplicate asset importer identifier '${importer.identifier}'.`)
    }

    identifiers.add(importer.identifier)
    for (const extension of importer.extensions) {
      if (extensions.has(extension)) {
        throw new Error(`Duplicate asset importer extension '${extension}'.`)
      }

      extensions.add(extension)
    }
  }

  private attachImporter(importer: AssetImporter): void {
    this._importers.set(importer.identifier, importer)
    for (const extension of importer.extensions) {
      this._extensions.set(extension, importer)
    }
  }
}

function extensionOf(source: string): string | undefined {
  const query = source.search(/[?#]/)
  const path = query === -1 ? source : source.slice(0, query)
  const name = path.slice(path.lastIndexOf('/') + 1)
  const index = name.lastIndexOf('.')

  return index <= 0 ? undefined : name.slice(index).toLowerCase()
}
