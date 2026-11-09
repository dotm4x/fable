import { fetchSource } from '../helpers/fetch.js'
import { AssetImporter, type ImportedAsset } from '../importer.js'

/**
 * Loads JSON sources with `fetch` and parses their bodies.
 *
 * Parsed values are `unknown` until validated by the consumer. Failed
 * responses and invalid documents reject the load.
 */
export class JsonImporter extends AssetImporter {
  public constructor() {
    super({ identifier: 'json', extensions: ['json'] })
  }

  /** @inheritDoc */
  public override async load(source: string, signal: AbortSignal): Promise<ImportedAsset> {
    const response = await fetchSource(source, signal)

    return { value: JSON.parse(await response.text()) as unknown }
  }
}
