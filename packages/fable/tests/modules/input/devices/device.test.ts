import { describe, expect, it, vi } from 'vitest'

import { InputDevice } from '../../../../source/index.js'

describe('InputDevice', () => {
  it('requires cleanup after failed startup and rejects destruction while active', () => {
    const cleanup = vi.fn()
    class Device extends InputDevice {
      public constructor() {
        super('test')
      }

      protected override onStart(): void {
        throw new Error('failed')
      }

      protected override onStop(): void {
        cleanup()
      }
    }
    const device = new Device()
    expect(() => {
      device.start(new EventTarget() as HTMLElement)
    }).toThrow('failed')
    expect(device.active).toBe(true)
    expect(() => {
      device.destroy()
    }).toThrow('active')
    device.stop()
    expect(cleanup).toHaveBeenCalledOnce()
    device.destroy()
  })
})
