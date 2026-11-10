import { TextureAddressMode } from '#/graphics/resources/textures/address-mode.js'
import { TextureFilter } from '#/graphics/resources/textures/filter.js'
import { type TextureSampler } from '#/graphics/resources/textures/sampler.js'
import { type Matrix4x4 } from '#/math/primitives/matrices/matrix4x4.js'

/** Returns the value, throwing when the driver returned null. */
export function required<TValue>(value: TValue | null, message: string): TValue {
  if (value === null) {
    throw new Error(message)
  }

  return value
}

/** Serializes a matrix in column-major order for `uniformMatrix4fv`. */
export function matrixValues(matrix: Matrix4x4): Float32Array {
  return new Float32Array([
    matrix.m11,
    matrix.m12,
    matrix.m13,
    matrix.m14,
    matrix.m21,
    matrix.m22,
    matrix.m23,
    matrix.m24,
    matrix.m31,
    matrix.m32,
    matrix.m33,
    matrix.m34,
    matrix.m41,
    matrix.m42,
    matrix.m43,
    matrix.m44,
  ])
}

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
}
