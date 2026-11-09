import { type Vector2 } from '../../../../../core/math/primitives/vectors/vector2.js'
import { InputEvent } from '../../event.js'
import { type MouseButton } from '../button.js'

/** Browser button numbers: primary 0, middle 1, secondary 2, back 3, forward 4. */
export interface MouseButtonEventPayload {
  readonly button: MouseButton
  readonly down: boolean
  readonly clicks: number
  /** CSS-pixel position relative to the element's bounding rectangle. */
  readonly position: Vector2
}

/** A named action bound to a browser mouse button number. */
export class MouseButtonEvent extends InputEvent<MouseButtonEventPayload, MouseButton> {}
