import { type Node } from '#/core/node/node.js'
import { type DrawCommand } from '#/graphics/commands/command.js'
import { type DrawContext } from '#/graphics/interfaces/context.js'
import { type Drawable } from '#/graphics/interfaces/drawable.js'

import { type ScenesModule } from '../../scenes/module.js'

import { RenderSpace, type RenderSpaceOptions } from './space.js'

/** Configuration for a space that collects commands from scene nodes. */
export interface NodeRenderSpaceOptions extends Omit<RenderSpaceOptions, 'entries'> {
  /** Scenes module whose active scene is borrowed and drawn. */
  readonly scenes: ScenesModule
}

/**
 * Collects drawing commands from the loaded, visible nodes of the active scene.
 *
 * Nodes are traversed in hierarchy order. Destroyed or invisible nodes are
 * skipped together with their subtrees. The scenes module and its nodes are
 * borrowed and never destroyed by this space.
 */
export class NodeRenderSpace extends RenderSpace {
  private readonly _scenes: ScenesModule

  /**
   * @param options - Space configuration and the scenes module to borrow.
   */
  public constructor({ scenes, ...options }: NodeRenderSpaceOptions) {
    super(options)
    this._scenes = scenes
  }

  /** @inheritDoc */
  public override collect(context: DrawContext): DrawCommand[] {
    this.throwIfDestroyed()
    const commands: DrawCommand[] = []
    this.visit(this._scenes.activeScene.value, context, commands)

    return commands
  }

  private visit(node: Node, context: DrawContext, commands: DrawCommand[]): void {
    if (node.destroyed || !node.visible.value) return
    if (node.loaded && isDrawable(node)) commands.push(...node.draw(context).commands)
    for (const child of [...node.children]) this.visit(child, context, commands)
  }
}

function isDrawable(node: Node): node is Node & Drawable {
  return 'draw' in node && typeof node.draw === 'function'
}
