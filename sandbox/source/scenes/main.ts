import { Camera2D, type GraphicMaterial, Node2D, Vector2 } from '@dotm4x/fable'

import { MyInputModule } from '../input/module.js'

import { TriangleNode } from './triangle.js'

export class MainScene extends Node2D {
  public readonly camera: Camera2D
  public readonly triangle: TriangleNode

  public constructor(material: GraphicMaterial) {
    const camera = new Camera2D({ name: 'camera' })
    const triangle = new TriangleNode(material)
    const left = new TriangleNode(material, 'triangle-left', new Vector2(-160, 0))
    const right = new TriangleNode(material, 'triangle-right', new Vector2(160, 0))
    super({ name: 'main', children: [camera, triangle, left, right] })
    this.camera = camera
    this.triangle = triangle
    left.scale.value = new Vector2(0.5, 0.5)
    right.scale.value = new Vector2(0.5, 0.5)
    camera.position.value = new Vector2(0, 0)
  }

  protected override configure(): void {
    this.require(MyInputModule).keyboard.space.connect(() => {
      console.log('hola')
    })
  }

  protected override onLoad(): void {
    console.log('scene start')
  }
}
