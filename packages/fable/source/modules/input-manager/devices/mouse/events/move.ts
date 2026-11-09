import { type Vector2 } from '../../../../../core/math/primitives/vectors/vector2.js'

/** Cursor position and browser-reported movement in CSS pixels. */
export interface MouseMoveEventPayload {
  readonly position: Vector2
  readonly delta: Vector2
}
