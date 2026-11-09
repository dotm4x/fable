import { describe, expect, it } from 'vitest'

import { ClearCommand, Color, type DrawCommand, DrawData } from '../../source/index.js'

describe('DrawData', () => {
  it('copies and freezes commands in execution order', () => {
    const first: DrawCommand = new ClearCommand(Color.black)
    const second: DrawCommand = new ClearCommand(Color.white)
    const commands = [first, second]
    const data = new DrawData(commands)

    commands.pop()

    expect(data.commands).toEqual([first, second])
    expect(Object.isFrozen(data.commands)).toBe(true)
  })

  it('accepts empty command lists', () => {
    expect(new DrawData([]).commands).toEqual([])
  })
})
