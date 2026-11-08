import { describe, expect, expectTypeOf, it, vi } from 'vitest'

import { Event, type ReadOnlyEvent, type ReadOnlyEventConnection } from '../../source/index.js'

describe('Event', () => {
  it('exposes subscriptions and connection state through read-only interfaces', () => {
    expectTypeOf<keyof ReadOnlyEvent<number>>().toEqualTypeOf<'connect' | 'destroyed'>()
    expectTypeOf<keyof ReadOnlyEventConnection>().toEqualTypeOf<
      'connected' | 'destroyed' | 'persistent'
    >()

    const event = new TestEvent()
    const readOnly: ReadOnlyEvent<number> = event
    const callback = vi.fn()
    const connection = readOnly.connect(callback)
    const readOnlyConnection: ReadOnlyEventConnection = connection

    event.emit(1)
    expect(callback).toHaveBeenCalledWith(1)
    expect(readOnlyConnection.connected).toBe(true)
    connection.disconnect()
    expect(readOnlyConnection.destroyed).toBe(true)
  })
})

class TestEvent extends Event<number> {
  public emit(value: number): void {
    this.dispatch(value)
  }
}
