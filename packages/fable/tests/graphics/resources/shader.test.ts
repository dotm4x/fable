import { describe, expect, it } from 'vitest'

import { Shader, ShaderLanguage, ShaderStage } from '../../../source/index.js'

describe('Shader', () => {
  it('exposes source code metadata with a default entry point', () => {
    const shader = new Shader({
      code: '@vertex fn main() {}',
      language: ShaderLanguage.wgsl,
      stage: ShaderStage.vertex,
    })

    expect(shader.code).toBe('@vertex fn main() {}')
    expect(shader.language).toBe(ShaderLanguage.wgsl)
    expect(shader.stage).toBe(ShaderStage.vertex)
    expect(shader.entryPoint).toBe('main')
    expect(shader.path).toBeUndefined()
  })

  it('accepts a custom entry point and source path', () => {
    const shader = new Shader({
      code: '@fragment fn shade() {}',
      language: ShaderLanguage.wgsl,
      stage: ShaderStage.fragment,
      entryPoint: 'shade',
      path: 'shaders/fragment.wgsl',
    })

    expect(shader.entryPoint).toBe('shade')
    expect(shader.path).toBe('shaders/fragment.wgsl')
  })

  it('rejects empty source code and empty entry points', () => {
    expect(
      () =>
        new Shader({
          code: ' ',
          language: ShaderLanguage.wgsl,
          stage: ShaderStage.vertex,
        }),
    ).toThrow('source code must not be empty')
    expect(
      () =>
        new Shader({
          code: '@vertex fn main() {}',
          language: ShaderLanguage.wgsl,
          stage: ShaderStage.vertex,
          entryPoint: ' ',
        }),
    ).toThrow('entry point must not be empty')
  })
})
