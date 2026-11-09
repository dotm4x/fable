import { type Vector2 } from '#core/math/primitives/vectors/vector2.js'

/** Browser wheel delta; `deltaMode` identifies its units (pixels, lines, or pages). */
export interface MouseWheelEventPayload {
  readonly position: Vector2
  readonly delta: Vector2
  readonly deltaMode: number
}
