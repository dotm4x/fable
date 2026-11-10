import { type Camera2D, type GraphicMaterial, Node2D, SpriteNode, Vector2 } from '@dotm4x/fable'

import { TriangleNode } from './triangle.js'

export class MainScene extends Node2D {
  public readonly camera: Camera2D
  public readonly triangle: TriangleNode

  public constructor(material: GraphicMaterial, camera: Camera2D) {
    const triangle = new TriangleNode(material)
    const left = new TriangleNode(material, 'triangle-left', new Vector2(-160, 0))
    const right = new TriangleNode(material, 'triangle-right', new Vector2(160, 0))
    const sprites = [
      new SpriteNode({
        name: 'sprite-0',
        material,
        size: new Vector2(90, 70),
        position: new Vector2(-250, -120),
        region: { min: new Vector2(0, 0), max: new Vector2(0.5, 0.5) },
      }),
      new SpriteNode({
        name: 'sprite-1',
        material,
        size: new Vector2(90, 70),
        position: new Vector2(250, -120),
        region: { min: new Vector2(0.5, 0), max: new Vector2(1, 0.5) },
      }),
      new SpriteNode({
        name: 'sprite-2',
        material,
        size: new Vector2(90, 70),
        position: new Vector2(-250, 120),
        region: { min: new Vector2(0, 0.5), max: new Vector2(0.5, 1) },
      }),
      new SpriteNode({
        name: 'sprite-3',
        material,
        size: new Vector2(90, 70),
        position: new Vector2(250, 120),
        region: { min: new Vector2(0.5, 0.5), max: new Vector2(1, 1) },
      }),
    ]
    super({ name: 'main', children: [triangle, left, right, ...sprites] })
    this.camera = camera
    this.triangle = triangle
    left.scale.value = new Vector2(0.5, 0.5)
    right.scale.value = new Vector2(0.5, 0.5)
    camera.position.value = new Vector2(0, 0)
  }
}
