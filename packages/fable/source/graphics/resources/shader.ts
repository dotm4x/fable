import { Resource } from '#/core/primitives/resource.js'

/** Language of shader source code. */
export enum ShaderLanguage {
  /** OpenGL Shading Language. */
  glsl = 'glsl',
  /** WebGPU Shading Language. */
  wgsl = 'wgsl',
}

/** Stage of the graphics pipeline at which a shader executes. */
export enum ShaderStage {
  /** Processes individual vertices. */
  vertex = 'vertex',
  /** Processes fragments produced by rasterized geometry. */
  fragment = 'fragment',
  /** Executes general-purpose computations. */
  compute = 'compute',
}

/** Configuration for a shader stage supplied as source code. */
export interface ShaderOptions {
  /** Shader source code. */
  readonly code: string
  /** Language of the source code. */
  readonly language: ShaderLanguage
  /** Graphics pipeline stage. */
  readonly stage: ShaderStage
  /** Shader entry point. Defaults to `main`. */
  readonly entryPoint?: string
  /** Optional source path used for diagnostics. */
  readonly path?: string
}

/**
 * A shader stage supplied as source code.
 *
 * A shader does not own a native graphics handle. Rendering backends create,
 * cache and release their native representations separately. Only source code
 * is supported; compiled shader binaries are not part of the engine yet.
 */
export class Shader extends Resource {
  /** Shader source code. */
  public readonly code: string

  /** Language of the source code. */
  public readonly language: ShaderLanguage

  /** Graphics pipeline stage. */
  public readonly stage: ShaderStage

  /** Shader entry point. */
  public readonly entryPoint: string

  /** Optional source path used for diagnostics. */
  public readonly path: string | undefined

  /**
   * @param options - Source code, language, stage, entry point and optional path.
   * @throws {@link Error} If the code or the entry point is empty.
   */
  public constructor({ code, language, stage, entryPoint = 'main', path }: ShaderOptions) {
    super()
    if (!code.trim()) {
      throw new Error('Shader source code must not be empty.')
    }

    if (!entryPoint.trim()) {
      throw new Error('Shader entry point must not be empty.')
    }

    this.code = code
    this.language = language
    this.stage = stage
    this.entryPoint = entryPoint
    this.path = path
  }
}
