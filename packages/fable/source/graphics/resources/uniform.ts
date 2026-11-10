import { type Matrix4x4 } from '#/math/primitives/matrices/matrix4x4.js'
import { type Vector2 } from '#/math/primitives/vectors/vector2.js'
import { type Vector3 } from '#/math/primitives/vectors/vector3.js'
import { type Vector4 } from '#/math/primitives/vectors/vector4.js'

import { type Color } from '../primitives/color.js'

/**
 * A value that can be uploaded to a shader uniform.
 *
 * Numbers map to `float`, colors and vectors to `vec2`–`vec4` and matrices to
 * `mat4`. Matrices follow the engine convention: a shader multiplying a vector
 * by them obtains the same result as the engine multiplying the vector by the
 * original matrix.
 */
export type UniformValue = number | Color | Vector2 | Vector3 | Vector4 | Matrix4x4

/** Uniform names owned by the rendering pipeline. */
export const reservedUniformNames: readonly string[] = [
  'uViewProjection',
  'uTransform',
  'uTextures',
]
