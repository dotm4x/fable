import { Resource } from '#/core/primitives/resource.js'

import { Shader, type ShaderLanguage, type ShaderStage } from './shader.js'

/** Configuration for shader source code loaded from a file. */
export interface ShaderSourceOptions {
  /** Shader source code. */
  readonly code: string
  /** Language of the source code. */
  readonly language: ShaderLanguage
  /** Optional source path used for diagnostics. */
  readonly path?: string
}

/**
 * Shader source code before it is bound to a pipeline stage.
 *
 * A source file can declare several entry points, so the stage and entry point
 * are selected when creating the {@link Shader} stages of a material.
 */
export class ShaderSource extends Resource {
  /** Shader source code. */
  public readonly code: string

  /** Language of the source code. */
  public readonly language: ShaderLanguage

  /** Optional source path used for diagnostics. */
  public readonly path: string | undefined

  /**
   * @param options - Source code, language and optional path.
   * @throws {@link Error} If the code is empty.
   */
  public constructor({ code, language, path }: ShaderSourceOptions) {
    super()
    if (!code.trim()) {
      throw new Error('Shader source code must not be empty.')
    }

    this.code = code
    this.language = language
    this.path = path
  }

  /**
   * Creates a stage shader that uses this source.
   *
   * @param stage - Graphics pipeline stage of the shader.
   * @param entryPoint - Entry point executed for the stage. Defaults to `main`.
   * @returns A shader that borrows this source code.
   */
  public shader(stage: ShaderStage, entryPoint: string = 'main'): Shader {
    return new Shader({
      code: this.code,
      language: this.language,
      stage,
      entryPoint,
      ...(this.path === undefined ? {} : { path: this.path }),
    })
  }
}
