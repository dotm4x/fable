import { Resource } from '#/core/primitives/resource.js'

import { type TextureBinding } from './textures/binding.js'
import { BlendMode } from './blend-mode.js'
import { type Shader } from './shader.js'
import { ShaderStage } from './shader.js'

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
}

/**
 * Graphical resources and state used to draw geometry.
 *
 * A material defines how geometry is processed by the graphics pipeline using
 * vertex and fragment shaders, together with the textures and samplers
 * consumed by those shaders. All referenced shaders, textures and samplers are
 * borrowed and are not destroyed with the material.
 */
export class GraphicMaterial extends Resource {
  /** Vertex shader used to process geometry vertices. */
  public readonly vertexShader: Shader

  /** Fragment shader used to process rasterized fragments. */
  public readonly fragmentShader: Shader

  /** Texture and sampler bindings consumed by the material. */
  public readonly textures: readonly TextureBinding[]

  /** How the material blends with the destination. */
  public readonly blend: BlendMode

  /**
   * @param options - Vertex and fragment shaders plus texture bindings.
   * @throws {@link Error} If a shader uses the wrong stage or the shaders mix languages.
   */
  public constructor({
    vertexShader,
    fragmentShader,
    textures = [],
    blend = BlendMode.alpha,
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
  }
}
