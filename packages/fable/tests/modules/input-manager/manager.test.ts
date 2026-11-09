import { describe, expect, it, vi } from 'vitest'

import {
  Game,
  InputDevice,
  InputManager,
  Keyboard,
  KeyboardInputEvent,
  Mouse,
  MouseButtonEvent,
} from '../../../source/index.js'

class TestGame extends Game {}

describe('InputManager', () => {
  it('subscribes only while running, delivers immediately and cleans up on stop and restart', () => {
    const target = Object.assign(new EventTarget(), {
      getBoundingClientRect: () => ({ left: 10, top: 20 }),
    }) as HTMLElement
    const key = new KeyboardInputEvent({ identifier: 'jump', source: 'Space' })
    const button = new MouseButtonEvent({ identifier: 'click', source: 0 })
    const keyboard = new Keyboard([key])
    const mouse = new Mouse([button])
    const manager = new InputManager({ target, devices: [keyboard, mouse] })
    const game = new TestGame([manager])
    const onKey = vi.fn()
    const onButton = vi.fn()
    key.connect(onKey)
    button.connect(onButton)
    const sendKey = (): void => {
      target.dispatchEvent(Object.assign(new Event('keydown'), { code: 'Space', repeat: false }))
    }
    sendKey()
    expect(onKey).not.toHaveBeenCalled()
    game.start()
    sendKey()
    expect(onKey).toHaveBeenCalledOnce()
    target.dispatchEvent(
      Object.assign(new Event('mousedown'), {
        button: 0,
        detail: 1,
        clientX: 14,
        clientY: 26,
      }),
    )
    expect(onButton).toHaveBeenCalledOnce()
    target.dispatchEvent(Object.assign(new Event('keyup'), { code: 'Space', repeat: false }))
    expect(onKey).toHaveBeenLastCalledWith({ key: 'Space', down: false, repeat: false })
    target.dispatchEvent(
      Object.assign(new Event('mousemove'), {
        clientX: 16,
        clientY: 28,
        movementX: 2,
        movementY: 2,
      }),
    )
    expect(mouse.position.value.x).toBe(6)
    const onWheel = vi.fn()
    mouse.onWheel.connect(onWheel)
    target.dispatchEvent(
      Object.assign(new Event('wheel'), {
        clientX: 16,
        clientY: 28,
        deltaX: 0,
        deltaY: 2,
        deltaMode: 0,
      }),
    )
    expect(onWheel).toHaveBeenCalledOnce()
    game.stop()
    sendKey()
    expect(onKey).toHaveBeenCalledTimes(2)
    game.start()
    sendKey()
    expect(onKey).toHaveBeenCalledTimes(3)
    game.stop()
    game.destroy()
    expect(key.destroyed).toBe(true)
    expect(button.destroyed).toBe(true)
    sendKey()
    expect(onKey).toHaveBeenCalledTimes(3)
  })

  it('registers additional devices and rolls back listeners after failed startup', () => {
    const target = new EventTarget() as HTMLElement
    const stops = vi.fn()
    class BrokenDevice extends InputDevice {
      public constructor() {
        super('broken')
      }
      protected override onStart(): void {
        throw new Error('device failed')
      }
      protected override onStop(): void {
        stops()
      }
    }
    const broken = new BrokenDevice()
    const action = new KeyboardInputEvent({ identifier: 'jump', source: 'Space' })
    const callback = vi.fn()
    action.connect(callback)
    const keyboard = new Keyboard([action])
    const manager = new InputManager({ target, devices: [keyboard, broken] })
    expect(manager.devices.get('broken')).toBe(broken)
    const game = new TestGame([manager])
    expect(() => {
      game.start()
    }).toThrow('device failed')
    expect(stops).toHaveBeenCalledOnce()
    expect(keyboard.active).toBe(false)
    target.dispatchEvent(Object.assign(new Event('keydown'), { code: 'Space', repeat: false }))
    expect(callback).not.toHaveBeenCalled()
    game.destroy()
    expect(broken.destroyed).toBe(true)
  })

  it('starts empty and accepts composed keyboard and mouse devices', () => {
    const target = new EventTarget() as HTMLElement
    const keyboard = new Keyboard()
    const mouse = new Mouse()
    class Manager extends InputManager {
      protected override *compose(): Generator<InputDevice> {
        yield keyboard
        yield mouse
      }
    }
    const manager = new Manager({ target })
    expect(manager.devices.size).toBe(0)
    const game = new TestGame([manager])
    game.start()
    expect([...manager.devices.values()]).toEqual([keyboard, mouse])
    game.stop()
    game.destroy()
    expect(keyboard.destroyed).toBe(true)
    expect(mouse.destroyed).toBe(true)
  })

  it('rejects duplicate device identifiers without taking ownership', () => {
    const first = new Keyboard()
    const second = new Keyboard()
    expect(
      () =>
        new InputManager({ target: new EventTarget() as HTMLElement, devices: [first, second] }),
    ).toThrow('Duplicate')
    expect(first.destroyed).toBe(false)
    expect(second.destroyed).toBe(false)
    first.destroy()
    second.destroy()
  })

  it('composes and configures devices once across restarts', () => {
    const target = new EventTarget() as HTMLElement
    const configure = vi.fn()
    const starts = vi.fn()
    const stops = vi.fn()
    class Device extends InputDevice {
      public constructor() {
        super('custom')
      }
      protected override onStart(): void {
        starts()
      }
      protected override onStop(): void {
        stops()
      }
    }
    const device = new Device()
    class Manager extends InputManager {
      protected override *compose(): Generator<InputDevice> {
        yield device
      }
      protected override configure(): void {
        configure()
      }
    }
    const manager = new Manager({ target })
    const game = new TestGame([manager])
    game.start()
    game.stop()
    game.start()
    game.stop()
    expect(manager.devices.get('custom')).toBe(device)
    expect(configure).toHaveBeenCalledOnce()
    expect(starts).toHaveBeenCalledTimes(2)
    expect(stops).toHaveBeenCalledTimes(2)
    game.destroy()
    expect(device.destroyed).toBe(true)
  })
})
