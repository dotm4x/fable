import { describe, expect, it } from 'vitest'

import {
  BlendMode,
  GraphicMaterial,
  Image,
  ImageTexture,
  Shader,
  ShaderLanguage,
  ShaderStage,
  TextureBinding,
  TextureSampler,
} from '../../../source/index.js'

function createShader(stage: ShaderStage, language: ShaderLanguage = ShaderLanguage.glsl): Shader {
  return new Shader({ code: 'code', language, stage })
}

describe('GraphicMaterial', () => {
  it('exposes shaders and texture bindings', () => {
    const image = new Image(1, 1, new Uint8Array(4))
    const sampler = new TextureSampler()
    const binding = new TextureBinding(new ImageTexture(image), sampler)
    const material = new GraphicMaterial({
      vertexShader: createShader(ShaderStage.vertex),
      fragmentShader: createShader(ShaderStage.fragment),
      textures: [binding],
    })

    expect(material.textures).toEqual([binding])
    expect(Object.isFrozen(material.textures)).toBe(true)
    material.destroy()
    sampler.destroy()
    image.destroy()
  })

  it('defaults to alpha blending and accepts other blend modes', () => {
    const material = new GraphicMaterial({
      vertexShader: createShader(ShaderStage.vertex),
      fragmentShader: createShader(ShaderStage.fragment),
    })
    const additive = new GraphicMaterial({
      vertexShader: createShader(ShaderStage.vertex),
      fragmentShader: createShader(ShaderStage.fragment),
      blend: BlendMode.additive,
    })

    expect(material.blend).toBe(BlendMode.alpha)
    expect(additive.blend).toBe(BlendMode.additive)
    material.destroy()
    additive.destroy()
  })

  it('rejects shaders with the wrong stage or language', () => {
    expect(
      () =>
        new GraphicMaterial({
          vertexShader: createShader(ShaderStage.fragment),
          fragmentShader: createShader(ShaderStage.fragment),
        }),
    ).toThrow('vertex stage')

    expect(
      () =>
        new GraphicMaterial({
          vertexShader: createShader(ShaderStage.vertex),
          fragmentShader: createShader(ShaderStage.fragment, ShaderLanguage.wgsl),
        }),
    ).toThrow('same language')
  })
})
