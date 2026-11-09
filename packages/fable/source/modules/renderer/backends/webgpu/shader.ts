import { ShaderLanguage } from '#/graphics/resources/shader.js'
import { type Shader } from '#/graphics/resources/shader.js'

/**
 * Creates a WebGPU shader module from WGSL shader source.
 *
 * @param device - Device that owns the created module.
 * @param shader - Shader source to compile.
 * @returns The compiled shader module.
 * @throws {@link Error} If the shader is not written in WGSL.
 */
export function createShaderModule(device: GPUDevice, shader: Shader): GPUShaderModule {
  if (shader.language !== ShaderLanguage.wgsl) {
    throw new Error(`WebGPU requires WGSL shader source, but '${shader.language}' was supplied.`)
  }

  return device.createShaderModule({
    code: shader.code,
    ...(shader.path === undefined ? {} : { label: shader.path }),
  })
}
