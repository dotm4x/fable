import { Node } from '@dotm4x/fable'

import { MyInputManager } from '../../input-manager/module.js'

export class MainScene extends Node {
  protected override configure(): void {
    this.require(MyInputManager).keyboard.space.connect(() => {
      console.log('hola')
    })
  }

  protected override onLoad(): void {
    console.log('scene start')
  }
}
