import { type LogMessage, LogMessageKind } from '../message.js'

import { LogOutput, LogOutputPriority } from './output.js'

/** Writes structured messages to the browser or host console. */
export class ConsoleOutput extends LogOutput {
  public constructor() {
    super(LogOutputPriority.critical)
  }

  protected override onLog(message: LogMessage): void {
    const source = message.source.trim() || 'Unknown'
    const label = `[${source}] ${message.content}`
    const args = message.metadata === undefined ? [label] : [label, message.metadata]
    switch (message.kind) {
      case LogMessageKind.debug:
        console.debug(...args)
        break
      case LogMessageKind.information:
        console.info(...args)
        break
      case LogMessageKind.warn:
        console.warn(...args)
        break
      default:
        throw new Error(`Unknown log message kind: ${String(message.kind)}.`)
    }
  }
}
