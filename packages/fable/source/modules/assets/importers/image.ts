import { fetchSource } from '../helpers/fetch.js'
import { AssetImporter, type ImportedAsset } from '../importer.js'

/**
 * Decodes images with `createImageBitmap`.
 *
 * Supports PNG, JPEG and WebP. Animated GIF is not supported because an
 * `ImageBitmap` holds a single frame. Decoding does not depend on the renderer,
 * and the value is released with `ImageBitmap.close()`.
 *
 * Decoding cannot be cancelled once started; an aborted request rejects after
 * decoding completes and the decoded bitmap is closed.
 */
export class ImageImporter extends AssetImporter<ImageBitmap> {
  public constructor() {
    super({ identifier: 'image', extensions: ['png', 'jpg', 'jpeg', 'webp'] })
  }

  /** @inheritDoc */
  public override async load(
    source: string,
    signal: AbortSignal,
  ): Promise<ImportedAsset<ImageBitmap>> {
    const response = await fetchSource(source, signal)
    const blob = await response.blob()
    signal.throwIfAborted()

    const image = await createImageBitmap(blob)
    if (signal.aborted) {
      image.close()
      signal.throwIfAborted()
    }

    return {
      value: image,
      release: () => {
        image.close()
      },
    }
  }
}
