import { describe, expect, it, vi } from 'vitest'

import { Keyboard, KeyboardInputEvent } from '../../../../../source/index.js'

describe('Keyboard', () => {
  it('matches physical codes and supports rebinding, repeat and release', () => {
    const action = new KeyboardInputEvent({ identifier: 'jump', source: 'Space' })
    const keyboard = new Keyboard([action])
    const callback = vi.fn()
    action.connect(callback)
    keyboard.handle({ code: 'Space', repeat: true } as KeyboardEvent, true)
    action.source.value = 'KeyJ'
    keyboard.handle({ code: 'Space', repeat: false } as KeyboardEvent, false)
    keyboard.handle({ code: 'KeyJ', repeat: false } as KeyboardEvent, false)
    expect(callback.mock.calls).toEqual([
      [{ key: 'Space', down: true, repeat: true }],
      [{ key: 'KeyJ', down: false, repeat: false }],
    ])
    keyboard.destroy()
    expect(action.destroyed).toBe(true)
  })

  it('does not deliver to an action removed during dispatch', () => {
    const first = new KeyboardInputEvent({ identifier: 'first', source: 'KeyA' })
    const second = new KeyboardInputEvent({ identifier: 'second', source: 'KeyA' })
    const keyboard = new Keyboard([first, second])
    const callback = vi.fn()
    second.connect(callback)
    first.connect(() => {
      keyboard.events.delete(second)
      second.destroy()
    })
    keyboard.handle({ code: 'KeyA', repeat: false } as KeyboardEvent, true)
    expect(callback).not.toHaveBeenCalled()
    keyboard.destroy()
    expect(second.destroyed).toBe(true)
  })

  it('does not deliver unknown browser codes to unrelated actions', () => {
    const action = new KeyboardInputEvent({ identifier: 'jump', source: 'Space' })
    const keyboard = new Keyboard([action])
    const callback = vi.fn()
    action.connect(callback)
    keyboard.handle({ code: 'UnknownVendorCode', repeat: false } as KeyboardEvent, true)
    expect(callback).not.toHaveBeenCalled()
    keyboard.destroy()
  })
})
