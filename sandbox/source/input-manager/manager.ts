import { type InputDevice, InputManager } from '@dotm4x/fable'

import { MyKeyboard } from './devices/keyboard.js'

export class MyInputManager extends InputManager {
  protected override *compose(): Generator<InputDevice> {
    yield new MyKeyboard()
  }
}
