import { type Node } from '#/core/node/node.js'

import { type ScenesModule } from '../../scenes/module.js'
import { type UpdateContext } from '../context.js'
import { type Updatable } from '../interfaces/updatable.js'

import { Channel, type ChannelOptions } from './channel.js'

/** Configuration for a channel that updates the active scene's nodes. */
export interface NodeChannelOptions extends Omit<ChannelOptions, 'identifier'> {
  /** Scenes module borrowed by the channel. */
  readonly manager: ScenesModule
  /** Channel identifier; defaults to `nodes`. */
  readonly identifier?: string
}

/**
 * Updates loaded, updatable nodes in the active scene, in depth-first order.
 * The scenes module and nodes are borrowed and are never destroyed by this channel.
 */
export class NodeChannel extends Channel {
  private readonly _manager: ScenesModule

  public constructor({ manager, identifier = 'nodes', ...options }: NodeChannelOptions) {
    super({ ...options, identifier })
    this._manager = manager
  }

  protected override onUpdate(context: UpdateContext): void {
    this.visit(this._manager.activeScene.value, context)
  }

  private visit(node: Node, context: UpdateContext): void {
    if (!this.alive(node)) return
    if (node.loaded && this.updatable(node)) node.update(context)
    if (!this.alive(node)) return
    for (const child of [...node.children]) {
      this.visit(child, context)
    }
  }

  private alive(node: Node): boolean {
    return !node.destroyed
  }

  private updatable(node: Node): node is Node & Updatable {
    return 'update' in node && typeof node.update === 'function'
  }
}
