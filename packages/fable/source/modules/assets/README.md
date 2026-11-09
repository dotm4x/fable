# Assets

`AssetsModule` loads, caches, reloads and releases assets through registered
importers. Importers fetch and decode sources; the module owns the resulting
`Asset<TValue>` wrappers.

## Built-in importers

| Importer         | Extensions                       | Imported value         |
| ---------------- | -------------------------------- | ---------------------- |
| `JsonImporter`   | `.json`                          | Parsed `unknown` value |
| `TextImporter`   | `.txt`, `.text`                  | `string`               |
| `BinaryImporter` | `.bin`, `.dat`                   | `ArrayBuffer`          |
| `ImageImporter`  | `.png`, `.jpg`, `.jpeg`, `.webp` | `ImageBitmap`          |
| `AudioImporter`  | `.mp3`, `.wav`, `.ogg`           | `AudioBuffer`          |

Built-in importers are not registered automatically. Pass them to the module,
or register them later:

```ts
const assets = new AssetsModule({
  importers: [new JsonImporter(), new ImageImporter()],
})
assets.register(new AudioImporter())
```

Selection uses the source extension unless `load` receives an explicit `type`:

```ts
const image = await assets.load<ImageBitmap>('sprites/player.png')
const data = await assets.load<unknown>('data/custom', { type: 'json' })
```

Custom importers extend `AssetImporter` and return an `ImportedAsset`, leaving
ownership of the value to the module:

```ts
class ShaderImporter extends AssetImporter<string> {
  public constructor() {
    super({ identifier: 'shader', extensions: ['glsl'] })
  }

  public async load(source: string, signal: AbortSignal): Promise<ImportedAsset<string>> {
    const response = await fetch(source, { signal })
    return { value: await response.text() }
  }
}
```

## Ownership and release

The module owns importers and loaded assets; consumers borrow them.
`unload(key)` and module destruction release values by invoking the release
callback of their assets. Assets survive stopping and restarting the owning
game, and concurrent loads of the same key share one request.

## Hot reload

Browsers cannot watch arbitrary filesystem paths, so Fable does not poll
sources. Development tooling reports changes to the module's watcher:

```ts
assets.watcher.notify('sprites/player.png')
```

Each notification reimports every loaded asset whose source matches. The asset
identity is preserved, `Asset.onChange` fires with the previous and new values,
and the previous value is released afterwards:

```ts
const asset = await assets.load<ImageBitmap>('sprites/player.png')
asset.onChange.connect(({ value }) => repaint(value))
```

Duplicate notifications for the same source share one reload. A failed or
deleted source keeps the previous value. Reloads are aborted when their asset
is unloaded or the module is destroyed, and values that arrive afterwards are
released.

A Vite plugin, for example, can forward file change events:

```ts
server.watcher.on('change', (file) => assets.watcher.notify(`/${file}`))
```

## Browser limitations

- `ImageImporter` requires `createImageBitmap`. Animated GIF is not supported
  because an `ImageBitmap` holds a single frame, so `.gif` is not registered.
- Image decoding and Web Audio decoding cannot be cancelled once started. An
  aborted request rejects after decoding completes; the decoded bitmap is
  closed and the decoded audio buffer is discarded.
- `AudioImporter` creates one `AudioContext` per importer on first use and
  closes it when the importer is destroyed. Contexts may start suspended until
  a user gesture; decoding works, but playback is out of scope.
- Importers never create renderer or GPU resources, and they never start audio
  playback.
