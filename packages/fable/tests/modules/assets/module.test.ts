import { describe, expect, it, vi } from 'vitest'

import { AssetImporter, AssetsModule, Game, type ImportedAsset } from '../../../source/index.js'

class TestGame extends Game {}

class TestImporter extends AssetImporter<string> {
  public readonly sources: string[] = []
  public readonly released: string[] = []
  public honourSignal: boolean = false
  public hook: (source: string) => Promise<string> = (source) => Promise.resolve(source)

  public constructor(identifier: string = 'test', extensions: readonly string[] = ['test']) {
    super({ identifier, extensions })
  }

  public override async load(source: string, signal: AbortSignal): Promise<ImportedAsset<string>> {
    this.sources.push(source)
    const value = await this.hook(source)
    if (this.honourSignal) signal.throwIfAborted()

    return { value, release: () => this.released.push(value) }
  }
}

describe('AssetsModule', () => {
  it('loads, caches and deduplicates concurrent requests', async () => {
    const importer = new TestImporter()
    const assets = new AssetsModule({ importers: [importer] })

    const first = assets.load('a.test')
    const second = assets.load('a.test')
    expect(second).toBe(first)

    const asset = await first
    expect(asset.identifier).toBe('a.test')
    expect(asset.value).toBe('a.test')
    expect(importer.sources).toEqual(['a.test'])
    expect(await assets.load<string>('a.test')).toBe(asset)
    expect(assets.get('a.test')).toBe(asset)
    expect(assets.assets.get('a.test')).toBe(asset)
    expect(importer.sources).toEqual(['a.test'])

    assets.destroy()
    expect(asset.destroyed).toBe(true)
  })

  it('selects importers by extension or explicit type and caches by key', async () => {
    const texts = new TestImporter('text', ['txt'])
    const data = new TestImporter('data', ['json'])
    const assets = new AssetsModule({ importers: [texts, data] })

    await assets.load('a.txt')
    await assets.load('b.json?version=1')
    await assets.load('c.custom', { type: 'data' })
    const alias = await assets.load('other.txt', { key: 'alias' })

    expect(texts.sources).toEqual(['a.txt', 'other.txt'])
    expect(data.sources).toEqual(['b.json?version=1', 'c.custom'])
    expect(assets.get('alias')).toBe(alias)
    expect(await assets.load('unused.txt', { key: 'alias' })).toBe(alias)
    expect(() => assets.load('d.unknown')).toThrow('No asset importer is registered')
    expect(() => assets.load('d.txt', { type: 'missing' })).toThrow(
      "Asset importer 'missing' is not registered",
    )

    assets.destroy()
  })

  it('releases failed loads so they can be retried', async () => {
    const importer = new TestImporter()
    importer.hook = () => Promise.reject(new Error('network failed'))
    const assets = new AssetsModule({ importers: [importer] })

    await expect(assets.load('a.test')).rejects.toThrow('network failed')
    expect(assets.get('a.test')).toBeUndefined()
    expect(assets.assets.size).toBe(0)

    importer.hook = (source) => Promise.resolve(`retried:${source}`)
    const asset = await assets.load<string>('a.test')
    expect(asset.value).toBe('retried:a.test')

    assets.destroy()
  })

  it('destroys assets on unload and reloads on the next request', async () => {
    const importer = new TestImporter()
    const assets = new AssetsModule({ importers: [importer] })
    const asset = await assets.load<string>('a.test')

    expect(assets.unload('a.test')).toBe(true)
    expect(asset.destroyed).toBe(true)
    expect(importer.released).toEqual(['a.test'])
    expect(assets.get('a.test')).toBeUndefined()
    expect(assets.unload('a.test')).toBe(false)

    const reloaded = await assets.load<string>('a.test')
    expect(reloaded).not.toBe(asset)
    expect(importer.sources).toEqual(['a.test', 'a.test'])

    assets.destroy()
  })

  it('discards loads that finish after they are unloaded', async () => {
    const importer = new TestImporter()
    let resolve: (value: string) => void = () => undefined
    importer.hook = () =>
      new Promise<string>((resolveHook) => {
        resolve = resolveHook
      })
    const assets = new AssetsModule({ importers: [importer] })

    const pending = assets.load('a.test')
    expect(assets.unload('a.test')).toBe(true)
    resolve('late')

    await expect(pending).rejects.toThrow('no longer requested')
    expect(importer.released).toEqual(['late'])

    assets.destroy()
  })

  it('aborts pending loads when destroyed', async () => {
    const importer = new TestImporter()
    importer.honourSignal = true
    let resolve: (value: string) => void = () => undefined
    importer.hook = () =>
      new Promise<string>((resolveHook) => {
        resolve = resolveHook
      })
    const assets = new AssetsModule({ importers: [importer] })

    const pending = assets.load('a.test')
    assets.destroy()
    resolve('late')

    await expect(pending).rejects.toThrow()
    expect(importer.released).toEqual([])
  })

  it('rejects destroyed importers and duplicate identifiers or extensions', () => {
    expect(
      () =>
        new AssetsModule({
          importers: [new TestImporter('a', ['txt']), new TestImporter('a', ['json'])],
        }),
    ).toThrow('Duplicate asset importer identifier')
    expect(
      () =>
        new AssetsModule({
          importers: [new TestImporter('a', ['txt']), new TestImporter('b', ['TXT'])],
        }),
    ).toThrow('Duplicate asset importer extension')

    const destroyed = new TestImporter()
    destroyed.destroy()
    expect(() => new AssetsModule({ importers: [destroyed] })).toThrow('is destroyed')
  })

  it('composes and configures once across game restarts', () => {
    const importer = new TestImporter()
    class TestAssetsModule extends AssetsModule {
      public configureCount: number = 0

      protected override *compose(): Generator<AssetImporter> {
        yield importer
      }

      protected override configure(): void {
        this.configureCount++
        expect(this.importers.has('test')).toBe(true)
      }
    }

    const assets = new TestAssetsModule()
    const game = new TestGame([assets])
    game.start()
    expect(assets.configureCount).toBe(1)
    game.stop()
    game.start()
    expect(assets.configureCount).toBe(1)
    game.stop()
    game.destroy()

    expect(importer.destroyed).toBe(true)
  })

  it('reloads loaded sources in place and notifies consumers', async () => {
    const importer = new TestImporter()
    importer.hook = (source) => Promise.resolve(`first:${source}`)
    const assets = new AssetsModule({ importers: [importer] })
    const asset = await assets.load<string>('a.test')
    const changes: { previous: string; value: string }[] = []
    asset.onChange.connect((change) => changes.push(change))

    importer.hook = (source) => Promise.resolve(`second:${source}`)
    await assets.reload('a.test')

    expect(assets.get('a.test')).toBe(asset)
    expect(asset.value).toBe('second:a.test')
    expect(changes).toEqual([{ previous: 'first:a.test', value: 'second:a.test' }])
    expect(importer.released).toEqual(['first:a.test'])

    assets.destroy()
    expect(importer.released).toEqual(['first:a.test', 'second:a.test'])
  })

  it('reloads sources reported by the watcher', async () => {
    const importer = new TestImporter()
    const assets = new AssetsModule({ importers: [importer] })
    const asset = await assets.load<string>('a.test')
    importer.hook = (source) => Promise.resolve(`changed:${source}`)

    assets.watcher.notify('a.test')

    await vi.waitFor(() => {
      expect(asset.value).toBe('changed:a.test')
    })
    assets.destroy()
  })

  it('reloads assets cached under custom keys', async () => {
    const importer = new TestImporter()
    const assets = new AssetsModule({ importers: [importer] })
    const asset = await assets.load('a.test', { key: 'alias' })
    importer.hook = (source) => Promise.resolve(`changed:${source}`)

    await assets.reload('a.test')

    expect(assets.get('alias')).toBe(asset)
    expect(asset.value).toBe('changed:a.test')
    assets.destroy()
  })

  it('keeps the previous value when a reload fails', async () => {
    const importer = new TestImporter()
    importer.hook = (source) => Promise.resolve(`first:${source}`)
    const assets = new AssetsModule({ importers: [importer] })
    const asset = await assets.load<string>('a.test')

    importer.hook = () => Promise.reject(new Error('network failed'))
    await assets.reload('a.test')
    await assets.reload('missing.test')

    expect(asset.value).toBe('first:a.test')
    expect(asset.destroyed).toBe(false)
    expect(importer.released).toEqual([])
    expect(importer.sources).toEqual(['a.test', 'a.test'])

    assets.destroy()
  })

  it('coalesces concurrent reloads for the same source', async () => {
    const importer = new TestImporter()
    const assets = new AssetsModule({ importers: [importer] })
    const asset = await assets.load<string>('a.test')
    let resolve: (value: string) => void = () => undefined
    importer.hook = () =>
      new Promise<string>((resolveHook) => {
        resolve = resolveHook
      })

    const first = assets.reload('a.test')
    const second = assets.reload('a.test')
    assets.watcher.notify('a.test')
    resolve('second')
    await Promise.all([first, second])

    expect(importer.sources).toEqual(['a.test', 'a.test'])
    expect(asset.value).toBe('second')
    assets.destroy()
  })

  it('releases late reload values after disposal without replacing them', async () => {
    const importer = new TestImporter()
    let calls = 0
    let resolve: (value: string) => void = () => undefined
    importer.hook = () => {
      calls++
      return calls === 1
        ? Promise.resolve('first')
        : new Promise<string>((resolveHook) => {
            resolve = resolveHook
          })
    }

    const assets = new AssetsModule({ importers: [importer] })
    const asset = await assets.load<string>('a.test')

    const reload = assets.reload('a.test')
    assets.destroy()
    resolve('second')
    await reload

    expect(asset.destroyed).toBe(true)
    expect(importer.released).toEqual(['first', 'second'])
  })

  it('discards reloads for unloaded assets', async () => {
    const importer = new TestImporter()
    let calls = 0
    let resolve: (value: string) => void = () => undefined
    importer.hook = () => {
      calls++
      return calls === 1
        ? Promise.resolve('first')
        : new Promise<string>((resolveHook) => {
            resolve = resolveHook
          })
    }

    const assets = new AssetsModule({ importers: [importer] })
    const asset = await assets.load<string>('a.test')

    const reload = assets.reload('a.test')
    expect(assets.unload('a.test')).toBe(true)
    resolve('second')
    await reload

    expect(asset.destroyed).toBe(true)
    expect(assets.get('a.test')).toBeUndefined()
    expect(importer.released).toEqual(['first', 'second'])

    assets.destroy()
  })
})
