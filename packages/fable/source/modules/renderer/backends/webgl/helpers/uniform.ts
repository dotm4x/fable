import { Color } from '#/graphics/primitives/color.js'
import { type UniformValue } from '#/graphics/resources/uniform.js'
import { Matrix4x4 } from '#/math/primitives/matrices/matrix4x4.js'
import { Vector2 } from '#/math/primitives/vectors/vector2.js'
import { Vector3 } from '#/math/primitives/vectors/vector3.js'
import { Vector4 } from '#/math/primitives/vectors/vector4.js'

import { matrixValues } from './matrix.js'

/**
 * Uploads a custom uniform value.
 *
 * @param gl - Active context.
 * @param location - Location of the uniform in the active program.
 * @param value - Value to upload.
 * @throws {@link Error} If the value type is not supported.
 */
export function applyUniform(
  gl: WebGL2RenderingContext,
  location: WebGLUniformLocation,
  value: UniformValue,
): void {
  if (typeof value === 'number') {
    gl.uniform1f(location, value)
  } else if (value instanceof Color) {
    gl.uniform4f(location, value.r, value.g, value.b, value.a)
  } else if (value instanceof Vector4) {
    gl.uniform4f(location, value.x, value.y, value.z, value.w)
  } else if (value instanceof Vector3) {
    gl.uniform3f(location, value.x, value.y, value.z)
  } else if (value instanceof Vector2) {
    gl.uniform2f(location, value.x, value.y)
  } else if (value instanceof Matrix4x4) {
    gl.uniformMatrix4fv(location, false, matrixValues(value))
  } else {
    throw new Error('Unsupported uniform value.')
  }
}
