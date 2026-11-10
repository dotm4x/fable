import { describe, expect, it, vi } from 'vitest'

import {
  Game,
  LoggerModule,
  type LogMessage,
  LogMessageKind,
  LogOutput,
  LogOutputPriority,
} from '../../../source/index.js'

class TestGame extends Game {}

class TestOutput extends LogOutput {
  public readonly messages: LogMessage[] = []
  public hook: (message: LogMessage) => void = () => {
    // Override in tests.
  }

  protected override onLog(message: LogMessage): void {
    this.messages.push(message)
    this.hook(message)
  }
}

describe('LoggerModule', () => {
  it('dispatches in priority order, then notifies subscribers', () => {
    const calls: string[] = []
    const low = new TestOutput(LogOutputPriority.low)
    const high = new TestOutput(LogOutputPriority.high)
    low.hook = () => {
      calls.push('low')
    }

    high.hook = () => {
      calls.push('high')
    }

    const logger = new LoggerModule({ outputs: [low, high] })
    logger.onLog.connect(() => {
      calls.push('event')
    })
    logger.log('hello', { source: 'game', kind: LogMessageKind.debug, metadata: { frame: 1 } })
    expect(calls).toEqual(['high', 'low', 'event'])
    expect(high.messages).toEqual([
      { content: 'hello', source: 'game', kind: LogMessageKind.debug, metadata: { frame: 1 } },
    ])
    logger.destroy()
  })

  it('uses default message options and supports bound sources', () => {
    const output = new TestOutput()
    const logger = new LoggerModule({ outputs: [output] })
    logger.log('default')
    const source = logger.from('renderer')
    source.log('warning', { kind: LogMessageKind.warn })
    expect(output.messages).toEqual([
      { content: 'default', source: '', kind: LogMessageKind.information },
      { content: 'warning', source: 'renderer', kind: LogMessageKind.warn },
    ])
    logger.destroy()
    expect(() => {
      source.log('late')
    }).toThrow('destroyed')
    expect(() => logger.from('late')).toThrow('destroyed')
  })

  it('composes and configures once across game restarts', () => {
    const output = new TestOutput()
    class TestLoggerModule extends LoggerModule {
      public configureCount: number = 0
      protected override *compose(): Generator<LogOutput> {
        yield output
      }

      protected override configure(): void {
        this.configureCount++
        expect(this.outputs.has(output)).toBe(true)
      }
    }
    const logger = new TestLoggerModule()
    const game = new TestGame([logger])
    game.start()
    game.stop()
    game.start()
    game.stop()
    expect(logger.configureCount).toBe(1)
    game.destroy()
    expect(output.destroyed).toBe(true)
  })

  it('does not retry failed configuration', () => {
    class TestLoggerModule extends LoggerModule {
      protected override configure(): void {
        throw new Error('configure failed')
      }
    }
    const logger = new TestLoggerModule()
    const game = new TestGame([logger])
    expect(() => {
      game.start()
    }).toThrow('configure failed')
    expect(() => {
      game.start()
    }).toThrow('Logger module preparation')
    game.destroy()
  })

  it('cleans up an unregistered composed output when registration fails', () => {
    const output = new TestOutput()
    class TestLoggerModule extends LoggerModule {
      protected override *compose(): Generator<LogOutput> {
        yield output
      }
    }
    const logger = new TestLoggerModule()
    logger.outputs.onAdd.connect((added) => {
      logger.outputs.delete(added)
      throw new Error('registration failed')
    })
    const game = new TestGame([logger])
    expect(() => {
      game.start()
    }).toThrow('registration failed')
    expect(output.destroyed).toBe(true)
    expect(() => {
      game.start()
    }).toThrow('Logger module preparation')
    game.destroy()
  })

  it('uses a snapshot and propagates output failures without emitting success', () => {
    const first = new TestOutput(LogOutputPriority.high)
    const second = new TestOutput()
    const logger = new LoggerModule({ outputs: [first, second] })
    first.hook = () => {
      logger.outputs.delete(second)
    }

    logger.log('first')
    expect(second.messages).toHaveLength(1)
    const notified = vi.fn()
    logger.onLog.connect(notified)
    first.hook = () => {
      throw new Error('output failed')
    }

    expect(() => {
      logger.log('second')
    }).toThrow('output failed')
    expect(notified).not.toHaveBeenCalled()
    logger.destroy()
    expect(second.destroyed).toBe(false)
    second.destroy()
  })

  it('rejects destruction while running and retries output destruction', () => {
    class FailingOutput extends TestOutput {
      private _failed: boolean = false
      protected override onDestroy(): void {
        if (!this._failed) {
          this._failed = true
          throw new Error('destroy failed')
        }
      }
    }
    const first = new TestOutput()
    const second = new FailingOutput()
    const logger = new LoggerModule({ outputs: [first, second] })
    const game = new TestGame([logger])
    game.start()
    expect(() => {
      logger.destroy()
    }).toThrow('not idle')
    expect(first.destroyed).toBe(false)
    game.stop()
    expect(() => {
      game.destroy()
    }).toThrow('destroy failed')
    expect(first.destroyed).toBe(true)
    game.destroy()
    expect(second.destroyed).toBe(true)
    expect(logger.onLog.destroyed).toBe(true)
  })
})
