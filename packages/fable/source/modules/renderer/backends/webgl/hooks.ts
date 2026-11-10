import { type Draw2DCommand } from '#/graphics/commands/draw2d.js'
import { type DrawContext } from '#/graphics/interfaces/context.js'

/** Extension points invoked by the WebGL backend. */
export interface WebGlBackendHooks {
  /** Called before each command is encoded, for instrumentation or state control. */
  readonly beforeDraw?: (command: Draw2DCommand, context: DrawContext) => void
  /** Called after a frame is submitted. */
  readonly afterFrame?: () => void
}
