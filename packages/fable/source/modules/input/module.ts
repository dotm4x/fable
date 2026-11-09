import { Module, ModuleState } from '#core/module.js'
import { Once } from '#core/primitives/once.js'

import { type InputDevice } from './devices/device.js'

/** Configuration for browser input. The element is borrowed, not owned. */
export interface InputModuleOptions {
  /** Element receiving input; it must be focusable and focused for keyboard events. */
  readonly target: HTMLElement
  /** Initial devices whose ownership transfers to this module. */
  readonly devices?: Iterable<InputDevice>
}

/**
 * Owns and manages browser input devices for one element.
 *
 * Events are delivered immediately while the game is running, independently
 * of the time module. The built-in keyboard requires a focused target or
 * descendant; built-in mouse events are limited to the target and its descendants.
 * Devices do not prevent browser defaults or change focus.
 */
export class InputModule extends Module {
  private readonly _devices: Map<string, InputDevice> = new Map<string, InputDevice>()
  private readonly _preparation: Once = new Once(
    'Input module preparation failed or is in progress.',
  )
  /** Borrowed input element. */
  public readonly target: HTMLElement
  /** Devices indexed by stable identifier; the module retains ownership. */
  public get devices(): ReadonlyMap<string, InputDevice> {
    return new Map(this._devices)
  }

  public constructor({ target, devices = [] }: InputModuleOptions) {
    super({ identifier: 'org.js.fable.InputModule' })
    const initial = [...devices]
    const identifiers = initial.map((device) => device.identifier)
    if (new Set(identifiers).size !== identifiers.length) {
      throw new Error('Duplicate input device identifier.')
    }
    if (initial.some((device) => device.destroyed || device.active)) {
      throw new Error('Input devices must be alive and inactive.')
    }
    this.target = target
    for (const device of initial) {
      this._devices.set(device.identifier, device)
    }
  }

  /** Yields devices whose ownership transfers to the module. */
  protected *compose(): Generator<InputDevice, void, unknown> {
    // Override to yield devices.
  }

  /** Configures registered devices once before startup. */
  protected configure(): void {
    // Override to configure devices.
  }

  protected override onStart(): void {
    this._preparation.execute(() => {
      for (const device of this.compose()) {
        try {
          if (this._devices.has(device.identifier)) {
            throw new Error(`Duplicate input device identifier '${device.identifier}'.`)
          }
          if (device.destroyed || device.active) throw new Error('Input device is not available.')
          this._devices.set(device.identifier, device)
        } catch (error) {
          if (
            this._devices.get(device.identifier) !== device &&
            !device.destroyed &&
            !device.active
          ) {
            try {
              device.destroy()
            } catch (failure) {
              throw new AggregateError([error, failure], 'Input device cleanup failed.', {
                cause: failure,
              })
            }
          }
          throw error
        }
      }
      this.configure()
    })
    for (const device of this._devices.values()) device.start(this.target)
  }

  protected override onStop(): void {
    for (const device of [...this._devices.values()].reverse()) {
      if (device.active) device.stop()
    }
  }

  protected override onDestroy(): void {
    if (!this.state.destroyed && this.state.value !== ModuleState.idle) {
      throw new Error(`Module '${this.identifier}' cannot be destroyed while not idle.`)
    }
    for (const [identifier, device] of this._devices) {
      if (!device.destroyed) device.destroy()
      this._devices.delete(identifier)
    }
    super.onDestroy()
  }
}
