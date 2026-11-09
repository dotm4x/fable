import { type InputDevice, InputManager } from '@dotm4x/fable'

import { MyKeyboard } from './devices/keyboard.js'

export class MyInputManager extends InputManager {
  public readonly keyboard: MyKeyboard = new MyKeyboard()

  protected override *compose(): Generator<InputDevice> {
    yield this.keyboard
  }
}
