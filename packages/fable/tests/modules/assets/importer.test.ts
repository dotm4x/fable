import { describe, expect, it } from 'vitest'

import { AssetImporter, type ImportedAsset } from '../../../source/index.js'

class TestImporter extends AssetImporter<number> {
  public override load(source: string, signal: AbortSignal): Promise<ImportedAsset<number>> {
    signal.throwIfAborted()

    return Promise.resolve({ value: source.length })
  }
}

describe('AssetImporter', () => {
  it('normalizes extensions and preserves the identifier', () => {
    const importer = new TestImporter({ identifier: 'numbers', extensions: ['NUM', '.bin'] })

    expect(importer.identifier).toBe('numbers')
    expect(importer.extensions).toEqual(['.num', '.bin'])
  })

  it('rejects empty identifiers, empty extensions and duplicate extensions', () => {
    expect(() => new TestImporter({ identifier: ' ' })).toThrow('identifier must not be empty')
    expect(() => new TestImporter({ identifier: 'a', extensions: [''] })).toThrow(
      'extensions must not be empty',
    )
    expect(() => new TestImporter({ identifier: 'a', extensions: ['txt', '.TXT'] })).toThrow(
      'duplicate extension',
    )
  })
})
