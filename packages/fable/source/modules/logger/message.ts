/** Classification of a log message. */
export enum LogMessageKind {
  debug = 'debug',
  information = 'information',
  warn = 'warn',
}

/** A structured log message. */
export interface LogMessage {
  /** Text of the message. */
  readonly content: string
  /** Origin of the message, or an empty string when unspecified. */
  readonly source: string
  /** Classification of the message. */
  readonly kind: LogMessageKind
  /** Optional contextual values. */
  readonly metadata?: Readonly<{ [key: string]: unknown }>
}

/** Optional information associated with a log message. */
export interface LogOptions {
  /** Origin of the message. Defaults to an empty string. */
  readonly source?: string
  /** Classification of the message. Defaults to information. */
  readonly kind?: LogMessageKind
  /** Contextual values associated with the message. */
  readonly metadata?: Readonly<{ [key: string]: unknown }>
}

/** Options for a message with an already bound source. */
export type SourcedLogOptions = Omit<LogOptions, 'source'>
