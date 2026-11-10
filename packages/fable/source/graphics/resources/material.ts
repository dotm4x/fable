import { Resource } from '#/core/primitives/resource.js'

import { BlendMode } from './blend-mode.js'
import { type Shader } from './shader.js'
import { ShaderStage } from './shader.js'
import { type TextureBinding } from './textures/binding.js'
import { reservedUniformNames, type UniformValue } from './uniform.js'

/** Configuration for a graphical material. */
export interface GraphicMaterialOptions {
  /** Vertex shader used to process geometry vertices. */
  readonly vertexShader: Shader
  /** Fragment shader used to process rasterized fragments. */
  readonly fragmentShader: Shader
  /** Texture and sampler bindings consumed by the material. Defaults to none. */
  readonly textures?: Iterable<TextureBinding>
  /** How the material blends with the destination. Defaults to alpha. */
  readonly blend?: BlendMode
  /** Extra uniform values read by the shaders. Defaults to none. */
  readonly uniforms?: Iterable<readonly [string, UniformValue]>
}

/**
 * Graphical resources and state used to draw geometry.
 *
 * A material defines how geometry is processed by the graphics pipeline using
 * vertex and fragment shaders, together with the textures and samplers
 * consumed by those shaders. All referenced shaders, textures and samplers are
 * borrowed and are not destroyed with the material.
 *
 * Shaders may declare custom uniform values in addition to the uniforms owned
 * by the pipeline; they are provided with {@link uniforms} and
 * {@link setUniform}. Removed values stop being uploaded on the next draw.
 */
export class GraphicMaterial extends Resource {
  private readonly _uniforms: Map<string, UniformValue> = new Map<string, UniformValue>()

  /** Vertex shader used to process geometry vertices. */
  public readonly vertexShader: Shader

  /** Fragment shader used to process rasterized fragments. */
  public readonly fragmentShader: Shader

  /** Texture and sampler bindings consumed by the material. */
  public readonly textures: readonly TextureBinding[]

  /** How the material blends with the destination. */
  public readonly blend: BlendMode

  /**
   * @param options - Vertex and fragment shaders, texture bindings, blend mode
   * and custom uniforms.
   * @throws {@link Error} If a shader uses the wrong stage, the shaders mix
   * languages, or a custom uniform reuses a pipeline uniform name.
   */
  public constructor({
    vertexShader,
    fragmentShader,
    textures = [],
    blend = BlendMode.alpha,
    uniforms = [],
  }: GraphicMaterialOptions) {
    super()
    if (vertexShader.stage !== ShaderStage.vertex) {
      throw new Error('The vertex shader must use the vertex stage.')
    }

    if (fragmentShader.stage !== ShaderStage.fragment) {
      throw new Error('The fragment shader must use the fragment stage.')
    }

    if (vertexShader.language !== fragmentShader.language) {
      throw new Error('Both shaders of a material must use the same language.')
    }

    this.vertexShader = vertexShader
    this.fragmentShader = fragmentShader
    this.textures = Object.freeze([...textures])
    this.blend = blend
    for (const [name, value] of uniforms) this.setUniform(name, value)
  }

  /** Custom uniform values read by the shaders. */
  public get uniforms(): ReadonlyMap<string, UniformValue> {
    return this._uniforms
  }

  /**
   * Sets a custom uniform value.
   *
   * @param name - Uniform name declared by the shaders.
   * @param value - Value uploaded on the next draw.
   * @throws {@link Error} If the name is empty, reserved, or the value is invalid.
   */
  public setUniform(name: string, value: UniformValue): void {
    if (!name.trim()) {
      throw new Error('Uniform names must not be empty.')
    }

    if (reservedUniformNames.includes(name)) {
      throw new Error(`The uniform '${name}' is managed by the rendering pipeline.`)
    }

    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw new Error(`The uniform '${name}' must be a finite number.`)
    }

    this._uniforms.set(name, value)
  }

  /**
   * Removes a custom uniform value.
   *
   * @param name - Uniform name to remove.
   * @returns Whether the uniform was present.
   */
  public removeUniform(name: string): boolean {
    return this._uniforms.delete(name)
  }
}
