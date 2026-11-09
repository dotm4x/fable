import { fetchSource } from '../helpers/fetch.js'
import { AssetImporter, type ImportedAsset } from '../importer.js'

/**
 * Decodes audio with the Web Audio API.
 *
 * Supports MP3, WAV and OGG. A single `AudioContext` is created on first use
 * and reused for every import; the importer owns it and closes it when
 * destroyed. Decoding does not depend on playback and does not start one.
 *
 * Web Audio decoding cannot be cancelled once started, so an aborted request
 * rejects after decoding completes and the decoded buffer is discarded.
 */
export class AudioImporter extends AssetImporter<AudioBuffer> {
  private _context: AudioContext | undefined

  public constructor() {
    super({ identifier: 'audio', extensions: ['mp3', 'wav', 'ogg'] })
  }

  /** @inheritDoc */
  public override async load(
    source: string,
    signal: AbortSignal,
  ): Promise<ImportedAsset<AudioBuffer>> {
    const response = await fetchSource(source, signal)
    const data = await response.arrayBuffer()
    signal.throwIfAborted()

    const buffer = await this.context.decodeAudioData(data)
    signal.throwIfAborted()

    return { value: buffer }
  }

  protected override onDestroy(): void {
    const context = this._context
    this._context = undefined
    if (context !== undefined) {
      context.close().catch(() => undefined)
    }
  }

  private get context(): AudioContext {
    this._context ??= new AudioContext()

    return this._context
  }
}
