import {
  Color,
  Draw2DCommand,
  type Drawable,
  DrawData,
  type GraphicMaterial,
  GraphicMesh2D,
  GraphicVertex2D,
  Matrix3x2,
  Vector2,
} from '@dotm4x/fable'

/**
 * Draws a full-screen quad showing the contents of a render target.
 *
 * Texture coordinates are flipped vertically because WebGL render targets use
 * a bottom-left origin.
 */
export class CompositeNode implements Drawable {
  private readonly _material: GraphicMaterial
  private readonly _mesh: GraphicMesh2D

  public constructor(material: GraphicMaterial) {
    this._material = material
    this._mesh = new GraphicMesh2D(
      [
        new GraphicVertex2D(new Vector2(-320, -180), new Vector2(0, 1), Color.white),
        new GraphicVertex2D(new Vector2(320, -180), new Vector2(1, 1), Color.white),
        new GraphicVertex2D(new Vector2(320, 180), new Vector2(1, 0), Color.white),
        new GraphicVertex2D(new Vector2(-320, 180), new Vector2(0, 0), Color.white),
      ],
      [0, 1, 2, 0, 2, 3],
    )
  }

  public draw(): DrawData {
    return new DrawData([
      new Draw2DCommand({
        mesh: this._mesh,
        material: this._material,
        transform: Matrix3x2.identity,
      }),
    ])
  }
}
