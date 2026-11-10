import {
  Camera2D,
  Color,
  Draw2DCommand,
  type GraphicMaterial,
  GraphicMaterial as GraphicMaterialClass,
  GraphicMesh2D,
  GraphicVertex2D,
  Matrix3x2,
  RenderContext,
  RenderPass,
  type RenderPassContext,
  RenderPassPriority,
  type RenderTarget,
  Shader,
  ShaderLanguage,
  ShaderStage,
  TextureBinding,
  TextureSampler,
  Vector2,
} from '@dotm4x/fable'

const vertexSource = /* glsl */ `#version 300 es
precision highp float;

layout(location = 0) in vec2 aPosition;
layout(location = 1) in vec2 aTextureCoordinate;
layout(location = 2) in vec4 aColor;

uniform mat4 uViewProjection;
uniform mat4 uTransform;

out vec2 vTextureCoordinate;
out vec4 vColor;

void main() {
  gl_Position = uViewProjection * uTransform * vec4(aPosition, 0.0, 1.0);
  vTextureCoordinate = aTextureCoordinate;
  vColor = aColor;
}
`

const fragmentSource = /* glsl */ `#version 300 es
precision highp float;

uniform sampler2D uTextures[4];
uniform float uStrength;

in vec2 vTextureCoordinate;
in vec4 vColor;

out vec4 outColor;

void main() {
  vec4 color = texture(uTextures[0], vTextureCoordinate) * vColor;
  vec2 centered = vTextureCoordinate - vec2(0.5);
  float vignette = clamp(1.0 - uStrength * dot(centered, centered), 0.0, 1.0);
  outColor = vec4(color.rgb * vignette, color.a);
}
`

/**
 * Composites the offscreen scene into the window, darkening the corners with a
 * custom shader that reads a material uniform.
 */
export class PostProcessPass extends RenderPass {
  private static readonly _identifier: string = 'org.fable.sandbox.PostProcessPass'

  private readonly _material: GraphicMaterial
  private readonly _camera: Camera2D
  private readonly _mesh: GraphicMesh2D

  public constructor(target: RenderTarget) {
    super(PostProcessPass._identifier, RenderPassPriority.high)
    this._camera = new Camera2D()
    this._material = new GraphicMaterialClass({
      vertexShader: new Shader({
        code: vertexSource,
        language: ShaderLanguage.glsl,
        stage: ShaderStage.vertex,
      }),
      fragmentShader: new Shader({
        code: fragmentSource,
        language: ShaderLanguage.glsl,
        stage: ShaderStage.fragment,
      }),
      textures: [new TextureBinding(target, new TextureSampler())],
      uniforms: [['uStrength', 1.1]],
    })
    this._mesh = new GraphicMesh2D(
      [
        new GraphicVertex2D(new Vector2(-1, -1), new Vector2(0, 1), Color.white),
        new GraphicVertex2D(new Vector2(1, -1), new Vector2(1, 1), Color.white),
        new GraphicVertex2D(new Vector2(1, 1), new Vector2(1, 0), Color.white),
        new GraphicVertex2D(new Vector2(-1, 1), new Vector2(0, 0), Color.white),
      ],
      [0, 1, 2, 0, 2, 3],
    )
  }

  public execute({ backend }: RenderPassContext): void {
    this.throwIfDestroyed()
    const size = backend.viewport.size
    const scale = Matrix3x2.scaling(size.x / 2, size.y / 2)
    const context = new RenderContext(0, this._camera, backend.viewport)
    backend.render(
      [new Draw2DCommand({ mesh: this._mesh, material: this._material, transform: scale })],
      context,
    )
  }

  protected override onDestroy(): void {
    if (!this._material.destroyed) this._material.destroy()
    if (!this._camera.destroyed) this._camera.destroy()
    super.onDestroy()
  }
}
