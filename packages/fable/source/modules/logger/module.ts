import { ReactiveSet } from '#core/collections/reactive-set.js'
import { type ReadOnlySignal, Signal } from '#core/events/signal.js'
import { Module, ModuleState } from '#core/module.js'
import { Once } from '#core/primitives/once.js'

import { type LogOutput } from './outputs/output.js'
import { type LogMessage, LogMessageKind, type LogOptions } from './message.js'
import { SourcedLogger } from './sourced-logger.js'

/** Configuration for a logger. */
export interface LoggerModuleOptions {
  /** Initial outputs whose ownership transfers to the logger. */
  readonly outputs?: Iterable<LogOutput>
}

/**
 * Dispatches structured messages to owned outputs in descending priority order.
 *
 * Adding an output transfers ownership; deleting or clearing it returns
 * ownership without destroying it. Messages can be logged before startup.
 */
export class LoggerModule extends Module {
  private readonly _preparation: Once = new Once(
    'Logger module preparation has already failed or is in progress.',
  )
  private readonly _onLog: Signal<LogMessage> = new Signal<LogMessage>()

  /** Outputs owned by this logger. */
  public readonly outputs: ReactiveSet<LogOutput>

  /** Fired after a message reaches all outputs. Listener errors propagate. */
  public readonly onLog: ReadOnlySignal<LogMessage> = this._onLog

  public constructor({ outputs = [] }: LoggerModuleOptions = {}) {
    super({ identifier: 'org.js.fable.LoggerModule' })
    this.outputs = new ReactiveSet(outputs)
  }

  /** Yields outputs whose ownership transfers to this logger. */
  protected *compose(): Generator<LogOutput, void, unknown> {
    // Override to yield outputs.
  }

  /** Configures the logger once after composition. */
  protected configure(): void {
    // Override to configure the logger.
  }

  protected override onStart(): void {
    this._preparation.execute(() => {
      for (const output of this.compose()) {
        try {
          this.outputs.add(output)
        } catch (error) {
          if (!this.outputs.has(output) && !output.destroyed) {
            try {
              output.destroy()
            } catch (failure) {
              throw new AggregateError([error, failure], 'Composed output cleanup failed.', {
                cause: failure,
              })
            }
          }
          throw error
        }
      }
      this.configure()
    })
  }

  /**
   * Returns a logger bound to a source; the returned object borrows this logger.
   *
   * @param source - Origin of messages logged through the returned logger.
   * @throws {@link Error} If this logger has been destroyed.
   */
  public from(source: string): SourcedLogger {
    this.throwIfDestroyed()
    return new SourcedLogger(this, source)
  }

  /**
   * Creates and dispatches a message.
   *
   * @param content - Message text.
   * @param options - Optional source, classification, and metadata.
   * @throws {@link Error} If this logger or a destination has been destroyed,
   * or a destination or listener fails.
   */
  public log(content: string, options: LogOptions = {}): void {
    this.throwIfDestroyed()
    const message: LogMessage = {
      content,
      source: options.source ?? '',
      kind: options.kind ?? LogMessageKind.information,
      ...(options.metadata === undefined ? {} : { metadata: options.metadata }),
    }
    this.logMessage(message)
  }

  /**
   * Dispatches an existing message to a snapshot of outputs, then emits `onLog`.
   * Output and listener errors propagate and stop the current dispatch.
   *
   * @param message - The message to dispatch.
   * @throws {@link Error} If this logger or a destination has been destroyed,
   * or a destination or listener fails.
   */
  public logMessage(message: LogMessage): void {
    this.throwIfDestroyed()
    const outputs = [...this.outputs].sort((left, right) => right.priority - left.priority)
    for (const output of outputs) {
      output.log(message)
    }
    this._onLog.fire(message)
  }

  protected override onDestroy(): void {
    if (!this.state.destroyed && this.state.value !== ModuleState.idle) {
      throw new Error(`Module '${this.identifier}' cannot be destroyed while not idle.`)
    }
    for (const output of this.outputs) {
      if (!output.destroyed) {
        output.destroy()
      }
    }
    this.outputs.clear()
    if (!this._onLog.destroyed) {
      this._onLog.destroy()
    }
    super.onDestroy()
  }
}
