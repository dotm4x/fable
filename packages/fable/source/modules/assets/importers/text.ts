import { fetchSource } from '../helpers/fetch.js'
import { AssetImporter, type ImportedAsset } from '../importer.js'

/**
 * Loads plain-text sources with `fetch`.
 *
 * The response body is returned as stored. Failed responses reject the load.
 */
export class TextImporter extends AssetImporter<string> {
  public constructor() {
    super({ identifier: 'text', extensions: ['txt', 'text'] })
  }

  /** @inheritDoc */
  public override async load(source: string, signal: AbortSignal): Promise<ImportedAsset<string>> {
    const response = await fetchSource(source, signal)

    return { value: await response.text() }
  }
}
