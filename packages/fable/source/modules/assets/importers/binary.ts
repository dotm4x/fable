import { fetchSource } from '../helpers/fetch.js'
import { AssetImporter, type ImportedAsset } from '../importer.js'

/**
 * Loads raw binary sources with `fetch`.
 *
 * The response body is returned as an `ArrayBuffer`. Failed responses reject
 * the load.
 */
export class BinaryImporter extends AssetImporter<ArrayBuffer> {
  public constructor() {
    super({ identifier: 'binary', extensions: ['bin', 'dat'] })
  }

  /** @inheritDoc */
  public override async load(
    source: string,
    signal: AbortSignal,
  ): Promise<ImportedAsset<ArrayBuffer>> {
    const response = await fetchSource(source, signal)

    return { value: await response.arrayBuffer() }
  }
}
