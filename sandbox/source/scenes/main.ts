import { Node } from '@dotm4x/fable'

import { MyInputModule } from '../input/module.js'

export class MainScene extends Node {
  protected override configure(): void {
    this.require(MyInputModule).keyboard.space.connect(() => {
      console.log('hola')
    })
  }

  protected override onLoad(): void {
    console.log('scene start')
  }
}
