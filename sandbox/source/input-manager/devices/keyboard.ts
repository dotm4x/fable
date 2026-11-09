import { Keyboard, KeyboardInputEvent } from '@dotm4x/fable'

export class MyKeyboard extends Keyboard {
  public space: KeyboardInputEvent = new KeyboardInputEvent({
    identifier: 'space',
    source: 'Space',
  })

  protected override *compose(): Generator<KeyboardInputEvent> {
    yield this.space
  }

  protected override configure(): void {
    this.space.connect((payload) => {
      console.log(payload.key)
    })
  }
}
