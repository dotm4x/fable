import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  createShaderModule,
  Shader,
  ShaderLanguage,
  ShaderStage,
  WebGpuBackend,
} from '../../../../../source/index.js'

const canvas = { getContext: () => null } as unknown as HTMLCanvasElement

describe('WebGpuBackend', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reports when WebGPU is unavailable', async () => {
    vi.stubGlobal('navigator', {})

    await expect(WebGpuBackend.create({ canvas })).rejects.toThrow('WebGPU is not available')
  })

  it('reports when no adapter is available', async () => {
    vi.stubGlobal('navigator', {
      gpu: {
        requestAdapter: () => Promise.resolve(null),
        getPreferredCanvasFormat: () => 'bgra8unorm',
      },
    })

    await expect(WebGpuBackend.create({ canvas })).rejects.toThrow('adapter is not available')
  })
})

describe('createShaderModule', () => {
  it('compiles WGSL shader source', () => {
    const module = {}
    const createShaderModuleMock = vi.fn(() => module)
    const device = { createShaderModule: createShaderModuleMock } as unknown as GPUDevice
    const shader = new Shader({
      code: '@vertex fn main() {}',
      language: ShaderLanguage.wgsl,
      stage: ShaderStage.vertex,
      path: 'shader.wgsl',
    })

    expect(createShaderModule(device, shader)).toBe(module)
    expect(createShaderModuleMock).toHaveBeenCalledWith({
      code: '@vertex fn main() {}',
      label: 'shader.wgsl',
    })
  })

  it('rejects shader languages other than WGSL', () => {
    const device = { createShaderModule: vi.fn() } as unknown as GPUDevice
    const shader = new Shader({
      code: 'void main() {}',
      language: ShaderLanguage.glsl,
      stage: ShaderStage.vertex,
    })

    expect(() => createShaderModule(device, shader)).toThrow('requires WGSL')
  })
})
