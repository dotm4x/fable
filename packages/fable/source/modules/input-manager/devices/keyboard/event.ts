import { InputEvent } from '../event.js'

import { type KeyboardKey } from './key.js'

/** A physical keyboard key transition. `key` uses the browser's KeyboardEvent.code. */
export interface KeyboardEventPayload {
  readonly key: KeyboardKey
  readonly down: boolean
  readonly repeat: boolean
}

/** A named action bound to a physical keyboard code, such as `KeyW`. */
export class KeyboardInputEvent extends InputEvent<KeyboardEventPayload, KeyboardKey> {}
