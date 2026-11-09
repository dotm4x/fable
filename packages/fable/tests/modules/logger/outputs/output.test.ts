import { describe, expect, it } from 'vitest'

import { type LogMessage, LogMessageKind, LogOutput } from '../../../../source/index.js'

class TestOutput extends LogOutput {
  public count: number = 0
  protected override onLog(message: LogMessage): void {
    this.count += message.content.length
  }
}

describe('LogOutput', () => {
  it('processes messages and rejects use after destruction', () => {
    const output = new TestOutput()
    const message = { content: 'test', source: '', kind: LogMessageKind.information }
    output.log(message)
    expect(output.count).toBe(4)
    output.destroy()
    expect(() => {
      output.log(message)
    }).toThrow('destroyed')
  })
})
