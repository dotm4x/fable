import { describe, expect, expectTypeOf, it, vi } from 'vitest'

import {
  type KeyboardEventPayload,
  KeyboardInputEvent,
  type KeyboardKey,
} from '../../../../../source/index.js'

describe('KeyboardInputEvent', () => {
  it('exposes browser key identifiers as a constrained type', () => {
    expectTypeOf<'KeyA' | 'NumpadEnter' | 'F24' | 'IntlYen'>().toExtend<KeyboardKey>()
    expectTypeOf<'NotAKey'>().not.toExtend<KeyboardKey>()
    expectTypeOf<string>().not.toExtend<KeyboardKey>()
    expectTypeOf<KeyboardEventPayload['key']>().toEqualTypeOf<KeyboardKey>()
    expectTypeOf<KeyboardInputEvent['source']['value']>().toEqualTypeOf<KeyboardKey>()
  })
  it('publishes key transitions and supports rebinding', () => {
    const action = new KeyboardInputEvent({ identifier: 'jump', source: 'Space' })
    const listener = vi.fn()
    action.connect(listener)
    action.source.value = 'KeyJ'
    action.fire({ key: 'KeyJ', down: true, repeat: false })
    expect(listener).toHaveBeenCalledWith({ key: 'KeyJ', down: true, repeat: false })
    action.destroy()
  })
})
