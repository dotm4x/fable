import { type GraphicMaterial } from '#/graphics/resources/material.js'
import { type Shader, ShaderLanguage } from '#/graphics/resources/shader.js'

import { required } from '../helpers/index.js'

export interface GlProgram {
  readonly program: WebGLProgram
  readonly transform: WebGLUniformLocation
  readonly viewProjection: WebGLUniformLocation
  readonly textures: WebGLUniformLocation
  readonly uniforms: Map<string, WebGLUniformLocation | null>
}

export class GlPrograms {
  private readonly _gl: WebGL2RenderingContext
  private readonly _programs: Map<GraphicMaterial, GlProgram> = new Map<
    GraphicMaterial,
    GlProgram
  >()

  public constructor(gl: WebGL2RenderingContext) {
    this._gl = gl
  }

  /** Returns the program for a material, compiling it on first use. */
  public get(material: GraphicMaterial): GlProgram {
    if (material.destroyed) {
      throw new Error('The material is destroyed.')
    }

    const cached = this._programs.get(material)
    if (cached !== undefined) return cached
    if (
      material.vertexShader.language !== ShaderLanguage.glsl ||
      material.fragmentShader.language !== ShaderLanguage.glsl
    ) {
      throw new Error('The WebGL backend requires GLSL shader sources.')
    }

    const gl = this._gl
    const vertex = this.compile(gl.VERTEX_SHADER, material.vertexShader)
    const fragment = this.compile(gl.FRAGMENT_SHADER, material.fragmentShader)
    const program = required(gl.createProgram(), 'Unable to create a shader program.')
    gl.attachShader(program, vertex)
    gl.attachShader(program, fragment)
    gl.linkProgram(program)
    gl.deleteShader(vertex)
    gl.deleteShader(fragment)
    if (gl.getProgramParameter(program, gl.LINK_STATUS) !== true) {
      const log = gl.getProgramInfoLog(program) ?? 'unknown error'
      gl.deleteProgram(program)
      throw new Error(`Unable to link the shader program: ${log}`)
    }

    const viewProjection = gl.getUniformLocation(program, 'uViewProjection')
    const transform = gl.getUniformLocation(program, 'uTransform')
    const textures = gl.getUniformLocation(program, 'uTextures')
    if (viewProjection === null || transform === null || textures === null) {
      gl.deleteProgram(program)
      throw new Error(
        'Material shaders must declare uViewProjection, uTransform and uTextures uniforms.',
      )
    }

    const glProgram: GlProgram = {
      program,
      viewProjection,
      transform,
      textures,
      uniforms: new Map<string, WebGLUniformLocation | null>(),
    }
    this._programs.set(material, glProgram)

    return glProgram
  }

  /**
   * Returns the location of a custom uniform, or undefined when the shaders do
   * not use it.
   *
   * Locations are resolved once per program.
   *
   * @param program - Program declaring the uniform.
   * @param name - Uniform name.
   */
  public uniformLocation(program: GlProgram, name: string): WebGLUniformLocation | undefined {
    const cached = program.uniforms.get(name)
    if (cached !== undefined) return cached ?? undefined
    const location = this._gl.getUniformLocation(program.program, name)
    program.uniforms.set(name, location)

    return location ?? undefined
  }

  /** Deletes one compiled program. */
  public delete(material: GraphicMaterial): void {
    const cached = this._programs.get(material)
    if (cached === undefined) return
    this._gl.deleteProgram(cached.program)
    this._programs.delete(material)
  }

  /** Deletes every compiled program. */
  public clear(): void {
    for (const program of this._programs.values()) this._gl.deleteProgram(program.program)
    this._programs.clear()
  }

  private compile(type: number, shader: Shader): WebGLShader {
    const gl = this._gl
    const compiled = required(gl.createShader(type), 'Unable to create a shader.')
    gl.shaderSource(compiled, shader.code)
    gl.compileShader(compiled)
    if (gl.getShaderParameter(compiled, gl.COMPILE_STATUS) !== true) {
      const log = gl.getShaderInfoLog(compiled) ?? 'unknown error'
      gl.deleteShader(compiled)
      throw new Error(`Unable to compile a shader: ${log}`)
    }

    return compiled
  }
}
