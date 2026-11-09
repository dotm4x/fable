import {
  Color,
  Draw2DCommand,
  type Drawable,
  type DrawContext,
  DrawData,
  type GraphicMaterial,
  GraphicMesh2D,
  GraphicVertex2D,
  Matrix3x2,
  Node2D,
  Vector2,
} from '@dotm4x/fable'

/** A colorful triangle drawn by the renderer. */
export class TriangleNode extends Node2D implements Drawable {
  private readonly _material: GraphicMaterial
  private readonly _mesh: GraphicMesh2D
  private _elapsed: number = 0

  public constructor(
    material: GraphicMaterial,
    name: string = 'triangle',
    position: Vector2 = new Vector2(0, 0),
  ) {
    super({ name })
    this._material = material
    this.position.value = position
    this._mesh = new GraphicMesh2D([
      new GraphicVertex2D(new Vector2(-140, -80), new Vector2(0, 0), Color.white),
      new GraphicVertex2D(new Vector2(140, -80), new Vector2(1, 0), Color.white),
      new GraphicVertex2D(new Vector2(0, 120), new Vector2(0.5, 1), Color.white),
    ])
  }

  public draw(context: DrawContext): DrawData {
    this._elapsed += context.deltaTime
    const rotation = Matrix3x2.rotation(this._elapsed * 0.6)

    return new DrawData([
      new Draw2DCommand({
        mesh: this._mesh,
        material: this._material,
        transform: rotation.multiply(this.globalTransform),
      }),
    ])
  }
}
