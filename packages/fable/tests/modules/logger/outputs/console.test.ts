import { afterEach, describe, expect, it, vi } from 'vitest'

import { ConsoleOutput, LogMessageKind, LogOutputPriority } from '../../../../source/index.js'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ConsoleOutput', () => {
  it('uses console methods matching the message kind and preserves metadata', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {
      // Suppress console output during the test.
    })
    const info = vi.spyOn(console, 'info').mockImplementation(() => {
      // Suppress console output during the test.
    })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {
      // Suppress console output during the test.
    })
    const output = new ConsoleOutput()
    expect(output.priority).toBe(LogOutputPriority.critical)
    output.log({ content: 'debug', source: 'game', kind: LogMessageKind.debug })
    output.log({ content: 'info', source: '', kind: LogMessageKind.information })
    output.log({ content: 'warn', source: 'app', kind: LogMessageKind.warn, metadata: { id: 1 } })
    expect(debug).toHaveBeenCalledWith('[game] debug')
    expect(info).toHaveBeenCalledWith('[Unknown] info')
    expect(warn).toHaveBeenCalledWith('[app] warn', { id: 1 })
  })
})
