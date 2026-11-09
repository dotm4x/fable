import { describe, expect, it } from 'vitest'

import { ClearCommand, Color } from '../../../source/index.js'

describe('ClearCommand', () => {
  it('exposes the color used to clear the target', () => {
    const color = Color.black
    const command = new ClearCommand(color)

    expect(command.color).toBe(color)
  })

  it('compares commands by color', () => {
    const command = new ClearCommand(Color.black)

    expect(command.equals(new ClearCommand(Color.black))).toBe(true)
    expect(command.equals(new ClearCommand(Color.white))).toBe(false)
  })
})
