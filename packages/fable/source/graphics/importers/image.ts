import { fetchSource } from '#/modules/assets/helpers/fetch.js'
import { AssetImporter, type ImportedAsset } from '#/modules/assets/importer.js'

import { Image } from '../resources/image.js'

/**
 * Decodes images into CPU pixel data.
 *
 * Supports PNG, JPEG and WebP. Animated GIF is not supported because a raster
 * image holds a single frame. Decoding uses `createImageBitmap` and
 * `OffscreenCanvas`, independently from the renderer and from any GPU resource.
 *
 * Decoding cannot be cancelled once started, so an aborted request rejects
 * after decoding completes.
 */
export class ImageImporter extends AssetImporter<Image> {
  public constructor() {
    super({ identifier: 'image', extensions: ['png', 'jpg', 'jpeg', 'webp'] })
  }

  /** @inheritDoc */
  public override async load(source: string, signal: AbortSignal): Promise<ImportedAsset<Image>> {
    const response = await fetchSource(source, signal)
    const blob = await response.blob()
    signal.throwIfAborted()

    const image = await decodeImage(blob)
    if (signal.aborted) {
      image.destroy()
      signal.throwIfAborted()
    }

    return {
      value: image,
      release: () => {
        image.destroy()
      },
    }
  }
}

async function decodeImage(blob: Blob): Promise<Image> {
  const bitmap = await createImageBitmap(blob)
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const context = canvas.getContext('2d')
    if (context === null) {
      throw new Error('A two-dimensional canvas context is unavailable.')
    }

    context.drawImage(bitmap, 0, 0)
    const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height)

    return new Image(bitmap.width, bitmap.height, new Uint8Array(pixels.data))
  } finally {
    bitmap.close()
  }
}
