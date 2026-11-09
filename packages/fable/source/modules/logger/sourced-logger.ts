import { type SourcedLogOptions } from './message.js'
import { type LoggerModule } from './module.js'

/** Logger bound to a source; it borrows the underlying logger module. */
export class SourcedLogger {
  public constructor(
    private readonly _logger: LoggerModule,
    public readonly source: string,
  ) {}

  /**
   * Logs a message with this logger's source.
   *
   * @param content - Message text.
   * @param options - Optional classification and metadata.
   */
  public log(content: string, options: SourcedLogOptions = {}): void {
    this._logger.log(content, { ...options, source: this.source })
  }
}
