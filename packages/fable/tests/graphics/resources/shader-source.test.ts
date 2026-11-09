import { describe, expect, it } from 'vitest'

import { ShaderLanguage, ShaderSource, ShaderStage } from '../../../source/index.js'

describe('ShaderSource', () => {
  it('exposes source code and language', () => {
    const source = new ShaderSource({
      code: '@vertex fn main() {}',
      language: ShaderLanguage.wgsl,
      path: '/shaders/main.wgsl',
    })

    expect(source.code).toBe('@vertex fn main() {}')
    expect(source.language).toBe(ShaderLanguage.wgsl)
    expect(source.path).toBe('/shaders/main.wgsl')
    source.destroy()
  })

  it('creates stage shaders with the requested entry point', () => {
    const source = new ShaderSource({
      code: 'code',
      language: ShaderLanguage.glsl,
      path: '/shaders/main.glsl',
    })

    const vertex = source.shader(ShaderStage.vertex)
    const fragment = source.shader(ShaderStage.fragment, 'shade')

    expect(vertex.stage).toBe(ShaderStage.vertex)
    expect(vertex.entryPoint).toBe('main')
    expect(vertex.path).toBe('/shaders/main.glsl')
    expect(fragment.stage).toBe(ShaderStage.fragment)
    expect(fragment.entryPoint).toBe('shade')

    vertex.destroy()
    fragment.destroy()
    source.destroy()
  })

  it('rejects empty source code', () => {
    expect(() => new ShaderSource({ code: ' ', language: ShaderLanguage.wgsl })).toThrow(
      'source code must not be empty',
    )
  })
})
