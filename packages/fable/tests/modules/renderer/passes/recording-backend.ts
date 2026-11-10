import {
  type DrawCommand,
  type DrawContext,
  GraphicMaterial,
  RenderBackend,
  type RenderTarget,
  Shader,
  ShaderLanguage,
  ShaderStage,
  Vector2,
  Viewport,
} from '../../../../source/index.js'

/** Creates a material without backend-specific shaders. */
export function createTestMaterial(): GraphicMaterial {
  return new GraphicMaterial({
    vertexShader: new Shader({
      code: 'vertex',
      language: ShaderLanguage.wgsl,
      stage: ShaderStage.vertex,
    }),
    fragmentShader: new Shader({
      code: 'fragment',
      language: ShaderLanguage.wgsl,
      stage: ShaderStage.fragment,
    }),
  })
}

/** A backend that records the commands and contexts of each render call. */
export class RecordingBackend extends RenderBackend {
  private readonly _viewport: Viewport

  public readonly defaultMaterial: GraphicMaterial = createTestMaterial()
  public readonly rendered: DrawCommand[][] = []
  public readonly contexts: (DrawContext | undefined)[] = []
  public readonly targets: (RenderTarget | undefined)[] = []

  public constructor(viewport?: Viewport) {
    super('recording')
    this._viewport = viewport ?? new Viewport(new Vector2(0, 0), new Vector2(100, 50))
  }

  public get stats(): { drawCalls: number; batches: number } {
    return { drawCalls: 0, batches: 0 }
  }

  public get viewport(): Viewport {
    return this._viewport
  }

  public createMaterial(): GraphicMaterial {
    return createTestMaterial()
  }

  protected override onBeginFrame(): void {
    // Nothing to acquire.
  }

  protected override onEndFrame(): void {
    // Nothing to present.
  }

  protected override onRender(
    commands: readonly DrawCommand[],
    context: DrawContext | undefined,
    target: RenderTarget | undefined,
  ): void {
    this.rendered.push([...commands])
    this.contexts.push(context)
    this.targets.push(target)
  }
}
