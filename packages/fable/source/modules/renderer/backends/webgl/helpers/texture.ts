import { TextureAddressMode } from '#/graphics/resources/textures/address-mode.js'
import { TextureFilter } from '#/graphics/resources/textures/filter.js'
import { type TextureSampler } from '#/graphics/resources/textures/sampler.js'

/** Maps a texture address mode to its WebGL constant. */
export function wrapMode(gl: WebGL2RenderingContext, mode: TextureAddressMode): number {
  switch (mode) {
    case TextureAddressMode.repeat:
      return gl.REPEAT
    case TextureAddressMode.mirroredRepeat:
      return gl.MIRRORED_REPEAT
    case TextureAddressMode.clampToEdge:
      return gl.CLAMP_TO_EDGE
    default:
      throw new Error('Unsupported texture address mode.')
  }
}

/** Maps a texture filter to its WebGL constant. */
export function filterMode(gl: WebGL2RenderingContext, filter: TextureFilter): number {
  return filter === TextureFilter.nearest ? gl.NEAREST : gl.LINEAR
}

/** Applies sampler state to the currently bound texture. */
export function applySampler(
  gl: WebGL2RenderingContext,
  sampler: TextureSampler,
  mipmapped: boolean,
): void {
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapMode(gl, sampler.addressU))
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapMode(gl, sampler.addressV))
  let minFilter = filterMode(gl, sampler.minFilter)
  if (mipmapped) {
    minFilter =
      sampler.minFilter === TextureFilter.nearest
        ? gl.NEAREST_MIPMAP_LINEAR
        : gl.LINEAR_MIPMAP_LINEAR
  }

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minFilter)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filterMode(gl, sampler.magFilter))
  applyAnisotropy(gl, sampler.anisotropy)
}

function applyAnisotropy(gl: WebGL2RenderingContext, anisotropy: number): void {
  if (anisotropy <= 1) return
  const extension = gl.getExtension('EXT_texture_filter_anisotropic')
  if (extension === null) return
  const supported = extension.MAX_TEXTURE_MAX_ANISOTROPY_EXT as number
  const limit = (gl.getParameter(supported) as number | undefined) ?? anisotropy
  gl.texParameterf(gl.TEXTURE_2D, extension.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(anisotropy, limit))
}
