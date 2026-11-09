import { type ClearCommand } from './clear.js'
import { type Draw2DCommand } from './draw2d.js'

/**
 * A backend-independent drawing operation.
 *
 * A command describes the data required to perform a graphical operation
 * without defining how a rendering backend executes it. Add new command types
 * to this union so backends can dispatch on them exhaustively.
 */
export type DrawCommand = ClearCommand | Draw2DCommand
