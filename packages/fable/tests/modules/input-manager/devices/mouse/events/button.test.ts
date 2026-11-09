import { describe, expect, expectTypeOf, it, vi } from 'vitest'

import {
  type MouseButton,
  MouseButtonEvent,
  type MouseButtonEventPayload,
  Vector2,
} from '../../../../../../source/index.js'

describe('MouseButtonEvent', () => {
  it('exposes native button identifiers as a constrained type', () => {
    expectTypeOf<MouseButton>().toEqualTypeOf<0 | 1 | 2 | 3 | 4>()
    expectTypeOf<5>().not.toExtend<MouseButton>()
    expectTypeOf<MouseButtonEventPayload['button']>().toEqualTypeOf<MouseButton>()
    expectTypeOf<MouseButtonEvent['source']['value']>().toEqualTypeOf<MouseButton>()
  })
  it('publishes button transitions and supports rebinding', () => {
    const action = new MouseButtonEvent({ identifier: 'select', source: 0 })
    const listener = vi.fn()
    action.connect(listener)
    action.source.value = 2
    const payload: MouseButtonEventPayload = {
      button: 2,
      down: false,
      clicks: 1,
      position: new Vector2(1, 2),
    }
    action.fire(payload)
    expect(listener).toHaveBeenCalledWith(payload)
    action.destroy()
  })
})
