import { type ReadOnlySignal, Signal } from '../events/signal.js'

import { type Node } from './node.js'

interface CollectionLifecycle {
  added(node: Node): void
  deleted(node: Node): void
  destroy(): void
}

const lifecycles: WeakMap<NodeReactiveSet, CollectionLifecycle> = new WeakMap<
  NodeReactiveSet,
  CollectionLifecycle
>()
const constructionKey: unique symbol = Symbol('NodeReactiveSet')

/** @internal */
export function createNodeReactiveSet(owner: Node, nodes: ReadonlySet<Node>): NodeReactiveSet {
  return new NodeReactiveSet(constructionKey, owner, nodes)
}

/** @internal */
export function nodeSetLifecycle(collection: NodeReactiveSet): CollectionLifecycle {
  const lifecycle = lifecycles.get(collection)
  if (lifecycle === undefined) throw new Error('Node collection lifecycle is unavailable.')
  return lifecycle
}

/**
 * Reactive access to a node's owned children.
 *
 * Mutations update the hierarchy before notifying listeners. Listener errors
 * propagate without undoing completed mutations. Removing a child transfers
 * ownership back to the caller.
 */
export class NodeReactiveSet implements Iterable<Node> {
  private readonly _onAdd: Signal<[node: Node]> = new Signal<[node: Node]>()
  private readonly _onDelete: Signal<[node: Node]> = new Signal<[node: Node]>()

  /** Fired after a child is attached. */
  public readonly onAdd: ReadOnlySignal<[node: Node]> = this._onAdd
  /** Fired after a child is detached or destroyed by its owner. */
  public readonly onDelete: ReadOnlySignal<[node: Node]> = this._onDelete

  /** @internal Constructed by the owning node. */
  public constructor(
    key: typeof constructionKey,
    private readonly _owner: Node,
    private readonly _nodes: ReadonlySet<Node>,
  ) {
    if (key !== constructionKey) throw new Error('Node collections are created by their owner.')
    lifecycles.set(this, {
      added: (node) => {
        this._onAdd.fire(node)
      },
      deleted: (node) => {
        this._onDelete.fire(node)
      },
      destroy: () => {
        if (!this._onAdd.destroyed) this._onAdd.destroy()
        if (!this._onDelete.destroyed) this._onDelete.destroy()
      },
    })
  }

  /** Number of direct children. */
  public get size(): number {
    return this._nodes.size
  }

  /** Attaches an unowned node, transferring ownership to the parent. */
  public add(node: Node): this {
    if (!this._nodes.has(node)) this._owner.add(node)
    return this
  }

  /** Detaches a child without destroying it. */
  public delete(node: Node): boolean {
    return this._owner.remove(node)
  }

  /**
   * Detaches children in insertion order. If unloading or notification fails,
   * the error propagates and remaining children stay attached.
   */
  public clear(): void {
    for (const node of [...this._nodes]) this.delete(node)
  }

  /** Whether the node is a direct child. */
  public has(node: Node): boolean {
    return this._nodes.has(node)
  }

  /** Iterates direct children in insertion order. */
  public values(): IterableIterator<Node> {
    return this._nodes.values()
  }

  /** @inheritDoc */
  public [Symbol.iterator](): IterableIterator<Node> {
    return this.values()
  }

  /** Finds a child or descendant by identifier. */
  public getByIdentifier(identifier: string, recursive: boolean = false): Node | undefined {
    return this._owner.getByIdentifier(identifier, recursive)
  }

  /** Finds the first child or descendant with the given name. */
  public getByName(name: string, recursive: boolean = false): Node | undefined {
    return this._owner.getByName(name, recursive)
  }

  /** Resolves a path relative to the owning node. */
  public getByPath(path: string): Node | undefined {
    return this._owner.getByPath(path)
  }

  /** Finds children or descendants having a tag. */
  public getByTag(tag: string, recursive: boolean = false): Node[] {
    return this._owner.getByTag(tag, recursive)
  }
}
