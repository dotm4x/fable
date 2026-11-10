import { describe, expect, it } from 'vitest'

import {
  BlendMode,
  Color,
  GraphicMaterial,
  Image,
  ImageTexture,
  Matrix4x4,
  Shader,
  ShaderLanguage,
  ShaderStage,
  TextureBinding,
  TextureSampler,
  Vector2,
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

  it('stores custom uniform values', () => {
    const material = new GraphicMaterial({
      vertexShader: createShader(ShaderStage.vertex),
      fragmentShader: createShader(ShaderStage.fragment),
      uniforms: [['uTint', Color.red]],
    })

    material.setUniform('uScale', new Vector2(2, 3))
    material.setUniform('uTime', 1.5)

    expect(material.uniforms.get('uTint')).toEqual(Color.red)
    expect(material.uniforms.get('uScale')).toEqual(new Vector2(2, 3))
    expect(material.uniforms.get('uTime')).toBe(1.5)
    expect(material.removeUniform('uTime')).toBe(true)
    expect(material.removeUniform('uTime')).toBe(false)
    material.destroy()
  })

  it('rejects reserved, empty and non-finite uniform values', () => {
    const material = new GraphicMaterial({
      vertexShader: createShader(ShaderStage.vertex),
      fragmentShader: createShader(ShaderStage.fragment),
    })

    expect(() => {
      material.setUniform('', 1)
    }).toThrow('must not be empty')
    expect(() => {
      material.setUniform('uTransform', Matrix4x4.identity)
    }).toThrow('managed by the rendering pipeline')
    expect(() => {
      material.setUniform('uTime', Number.NaN)
    }).toThrow('finite number')
    material.destroy()
  })
})
