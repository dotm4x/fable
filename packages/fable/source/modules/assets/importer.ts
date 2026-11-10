import { type Identifiable } from '#/core/interfaces/identifiable.js'
import { Destroyable } from '#/core/primitives/destroyable.js'

/** A value produced by an importer, before the assets module wraps it in an asset. */
export interface ImportedAsset<TValue = unknown> {
  /** The imported value. */
  readonly value: TValue
  /** Releases resources held by the value when its asset is destroyed. */
  readonly release?: () => void
}

/** Configuration for an asset importer. */
export interface AssetImporterOptions {
  /** Identifier used to select the importer explicitly. */
  readonly identifier: string
  /** File extensions, with or without a leading dot, matched case-insensitively. */
  readonly extensions?: Iterable<string>
}

/**
 * Loads sources into values.
 *
 * The assets module wraps the imported value in an asset, which owns the value
 * and invokes its release callback. Importers are owned by the module, which
 * destroys them after their in-flight imports settle.
 *
 * @typeParam TValue - The type of the imported value.
 */
export abstract class AssetImporter<TValue = unknown>
  extends Destroyable
  implements Identifiable<string>
{
  /** Identifier used to select this importer explicitly. */
  public readonly identifier: string

  /** Normalized, lowercase extensions including their leading dot. */
  public readonly extensions: readonly string[]

  /**
   * @param options - Importer identifier and supported file extensions.
   * @throws {@link Error} If the identifier or an extension is empty or repeated.
   */
  public constructor({ identifier, extensions = [] }: AssetImporterOptions) {
    super()
    if (!identifier.trim()) {
      throw new Error('Asset importer identifier must not be empty.')
    }

    this.identifier = identifier
    const normalized = [...extensions].map((extension) => normalizeExtension(extension))
    if (new Set(normalized).size !== normalized.length) {
      throw new Error(`Asset importer '${identifier}' declares a duplicate extension.`)
    }

    this.extensions = Object.freeze(normalized)
  }

  /**
   * Imports a source into a value owned by the caller.
   *
   * @param source - Source to import.
   * @param signal - Signal aborted when the request is no longer needed.
   * @returns The imported value and its optional release callback.
   */
  public abstract load(source: string, signal: AbortSignal): Promise<ImportedAsset<TValue>>
}

function normalizeExtension(extension: string): string {
  const normalized = extension.trim().toLowerCase()
  if (!normalized) {
    throw new Error('Asset importer extensions must not be empty.')
  }

  return normalized.startsWith('.') ? normalized : `.${normalized}`
}
