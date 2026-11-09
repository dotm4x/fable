import { ReactiveSet } from '#core/collections/reactive-set.js'
import { Store } from '#core/events/store.js'
import { type Module, type ModuleType } from '#core/module.js'
import { Destroyable } from '#core/primitives/destroyable.js'
import { Once } from '#core/primitives/once.js'

import {
  createNodeReactiveSet,
  type NodeReactiveSet,
  nodeSetLifecycle,
} from './node-reactive-set.js'

/** Configuration for a node and its initially owned children. */
export interface NodeOptions {
  /** Initial display name. Defaults to `Node`. */
  readonly name?: string
  /** Initial visibility. */
  readonly visible?: boolean
  /** Whether this node stays loaded when its parent unloads. */
  readonly persistent?: boolean
  /** Initial tags. */
  readonly tags?: Iterable<string>
  /** Children whose ownership transfers to this node. */
  readonly children?: Iterable<Node>
}

/** @internal */
export interface NodeContext {
  require<TModule extends Module>(type: ModuleType<TModule>): TModule
  optional<TModule extends Module>(type: ModuleType<TModule>): TModule | undefined
}

interface NodeOwnership {
  claim(owner: object, context: NodeContext): void
  release(owner: object): void
  destroy(owner: object): void
  destroyIfUnowned(): void
}

const ownerships: WeakMap<Node, NodeOwnership> = new WeakMap<Node, NodeOwnership>()

/** @internal */
export function nodeOwnership(node: Node): NodeOwnership {
  const ownership = ownerships.get(node)
  if (ownership === undefined) throw new Error('Node ownership is unavailable.')
  return ownership
}

/**
 * A node in a scene hierarchy. Parents own children; detaching returns ownership.
 * Names are mutable and identifiers remain stable for the lifetime of a node.
 */
export class Node extends Destroyable {
  private readonly _preparation: Once = new Once(
    'Node preparation has already failed or is in progress.',
  )
  private readonly _children: Set<Node> = new Set<Node>()
  private _parent: Node | undefined
  private _owner: object | undefined
  private _context: NodeContext | undefined
  private _loaded: boolean = false
  private _transitioning: boolean = false
  private _destroying: boolean = false
  private _rollback: { preserved: ReadonlySet<Node>; initialized: boolean } | undefined

  /** Stable identifier. */
  public readonly identifier: string = crypto.randomUUID()
  /** Mutable display name. */
  public readonly name: Store<string>
  /** Mutable visibility. */
  public readonly visible: Store<boolean>
  /** User-defined tags. */
  public readonly tags: ReactiveSet<string>
  /** Whether parent unloading leaves this node loaded. */
  public readonly persistent: boolean
  /** Reactive collection of direct children owned by this node. */
  public readonly children: NodeReactiveSet

  public constructor({
    name = 'Node',
    visible = true,
    persistent = false,
    tags = [],
    children = [],
  }: NodeOptions = {}) {
    super()
    this.name = new Store(name)
    this.visible = new Store(visible)
    this.persistent = persistent
    this.tags = new ReactiveSet(tags)
    this.children = createNodeReactiveSet(this, this._children)
    ownerships.set(this, {
      claim: (owner, context) => {
        this.claim(owner, context)
      },
      release: (owner) => {
        this.release(owner)
      },
      destroy: (owner) => {
        if (this._owner !== owner) throw new Error('Scene is not owned by this manager.')
        this._owner = undefined
        try {
          this.destroy()
        } catch (error) {
          this._owner = owner
          throw error
        }
      },
      destroyIfUnowned: () => {
        if (
          this._owner === undefined &&
          this._parent === undefined &&
          !this.destroyed &&
          !this.loaded
        ) {
          this.destroy()
        }
      },
    })
    const initial = [...children]
    if (new Set(initial).size !== initial.length) {
      throw new Error('Duplicate child node.')
    }
    for (const child of initial) {
      this.validateChild(child)
    }
    for (const child of initial) {
      this._children.add(child)
      child._parent = this
    }
  }

  /** Parent, or undefined for a root node. */
  public get parent(): Node | undefined {
    return this._parent
  }
  /** Whether this node is loaded. */
  public get loaded(): boolean {
    return this._loaded
  }
  /** Slash-separated path formed from ancestor names. */
  public get path(): string {
    const names: string[] = [this.name.value]
    let node: Node | undefined = this._parent
    while (node !== undefined) {
      names.push(node.name.value)
      node = node._parent
    }
    return names.reverse().join('/')
  }

  /** Adds an unowned child. Loaded parents load the child immediately. */
  public add(child: Node): void {
    this.throwIfDestroyed()
    if (this._destroying) throw new Error('Cannot modify children while destroying the node.')
    this.validateChild(child)
    this._children.add(child)
    child._parent = this
    try {
      if (this._context !== undefined) child.setContext(this._context)
      if (this._loaded && !child.loaded) child.load()
    } catch (error) {
      if (!child.loaded) {
        this._children.delete(child)
        child._parent = undefined
        child.clearContext()
      } else {
        try {
          nodeSetLifecycle(this.children).added(child)
        } catch (failure) {
          throw new AggregateError(
            [error, failure],
            'Attaching a child and notifying listeners failed.',
            {
              cause: failure,
            },
          )
        }
      }
      throw error
    }
    nodeSetLifecycle(this.children).added(child)
  }

  /** Detaches a child without destroying it; non-persistent loaded children unload. */
  public remove(child: Node): boolean {
    this.throwIfDestroyed()
    if (this._destroying) throw new Error('Cannot modify children while destroying the node.')
    if (!this._children.has(child)) return false
    if (child.loaded && !child.persistent) child.unload()
    this._children.delete(child)
    child._parent = undefined
    child.clearContext()
    nodeSetLifecycle(this.children).deleted(child)
    return true
  }

  /** Searches direct children, or all descendants in depth-first order. */
  public *descendants(recursive: boolean = false): Generator<Node, void, unknown> {
    this.throwIfDestroyed()
    for (const child of [...this._children]) {
      yield child
      if (recursive) yield* child.descendants(true)
    }
  }

  /** Finds the first child or descendant with the given name. */
  public getByName(name: string, recursive: boolean = false): Node | undefined {
    return [...this.descendants(recursive)].find((node) => node.name.value === name)
  }

  /** Finds the first child or descendant with the given identifier. */
  public getByIdentifier(identifier: string, recursive: boolean = false): Node | undefined {
    return [...this.descendants(recursive)].find((node) => node.identifier === identifier)
  }

  /** Finds children or descendants having a tag. */
  public getByTag(tag: string, recursive: boolean = false): Node[] {
    return [...this.descendants(recursive)].filter((node) => node.tags.has(tag))
  }

  /** Resolves a relative path, including `.` and `..`. */
  public getByPath(path: string): Node | undefined {
    this.throwIfDestroyed()
    return path
      .split('/')
      .filter(Boolean)
      .reduce<Node | undefined>((current, part) => {
        if (current === undefined) return undefined
        if (part === '..') return current.parent
        return part === '.' ? current : current.getByName(part)
      }, this)
  }

  /** Yields additional owned children once, before configuration. */
  protected *compose(): Generator<Node, void, unknown> {
    // Override to yield children.
  }

  /** Called once after composition and before the first load. */
  protected configure(): void {
    // Override to configure the node.
  }

  /** Called after this node becomes loaded and before its children load. */
  protected onLoad(): void {
    // Override to initialize the node.
  }

  /** Called after children unload and before this node becomes unloaded. */
  protected onUnload(): void {
    // Override to clean up the node.
  }

  /** Resolves a dependency declared by the owning scene manager. */
  protected require<TModule extends Module>(type: ModuleType<TModule>): TModule {
    this.throwIfDestroyed()
    if (this._context === undefined)
      throw new Error('Node has no scene manager dependency context.')
    return this._context.require(type)
  }

  /** Gets a declared optional dependency, or undefined if it is absent. */
  protected optional<TModule extends Module>(type: ModuleType<TModule>): TModule | undefined {
    this.throwIfDestroyed()
    if (this._context === undefined)
      throw new Error('Node has no scene manager dependency context.')
    return this._context.optional(type)
  }

  /** Loads this node and its children; failed loads roll back newly loaded children. */
  public load(): void {
    this.throwIfDestroyed()
    if (
      this._loaded ||
      this._transitioning ||
      this._destroying ||
      (this._parent !== undefined && !this._parent.loaded)
    ) {
      throw new Error('Node cannot be loaded in its current state.')
    }
    this._transitioning = true
    try {
      this._preparation.execute(() => {
        for (const child of this.compose()) {
          try {
            this.add(child)
          } catch (error) {
            if (
              child._parent === undefined &&
              child._owner === undefined &&
              !child.destroyed &&
              !child.loaded
            ) {
              try {
                child.destroy()
              } catch (failure) {
                throw new AggregateError([error, failure], 'Node composition and cleanup failed.', {
                  cause: failure,
                })
              }
            }
            throw error
          }
        }
        this.configure()
      })
      const preserved = new Set([...this._children].filter((child) => child.loaded))
      this._loaded = true
      let initialized = false
      try {
        this.onLoad()
        initialized = true
        for (const child of [...this._children]) {
          if (!child.loaded) child.load()
        }
      } catch (error) {
        this._rollback = { preserved, initialized }
        try {
          this.unloadChildrenAndSelf()
        } catch (failure) {
          throw new AggregateError([error, failure], 'Node loading and rollback failed.', {
            cause: failure,
          })
        }
        throw error
      }
    } finally {
      this._transitioning = false
    }
  }

  /** Unloads non-persistent children and then this node. */
  public unload(): void {
    this.throwIfDestroyed()
    if (!this._loaded || this._transitioning)
      throw new Error('Node cannot be unloaded in its current state.')
    this._transitioning = true
    try {
      this.unloadChildrenAndSelf()
    } finally {
      this._transitioning = false
    }
  }

  private unloadChildrenAndSelf(): void {
    const rollback = this._rollback
    for (const child of [...this._children].reverse()) {
      if (
        child.loaded &&
        (rollback === undefined ? !child.persistent : !rollback.preserved.has(child))
      ) {
        child.unload()
      }
    }
    if (rollback === undefined || rollback.initialized) this.onUnload()
    this._loaded = false
    this._rollback = undefined
  }

  private validateChild(child: Node): void {
    if (
      child.destroyed ||
      child._parent !== undefined ||
      child._owner !== undefined ||
      child.loaded
    ) {
      throw new Error('Child must be alive, unloaded, and unowned.')
    }
    if (child === this) throw new Error('Node hierarchy cannot contain a cycle.')
    for (
      let ancestor: Node | undefined = this._parent;
      ancestor !== undefined;
      ancestor = ancestor._parent
    ) {
      if (ancestor === child) throw new Error('Node hierarchy cannot contain a cycle.')
    }
  }

  private setContext(context: NodeContext): void {
    this._context = context
    for (const child of this._children) child.setContext(context)
  }

  private clearContext(): void {
    this._context = undefined
    for (const child of this._children) child.clearContext()
  }

  private claim(owner: object, context: NodeContext): void {
    this.throwIfDestroyed()
    if (this._parent !== undefined || this._owner !== undefined || this.loaded) {
      throw new Error('Scene must be unowned, unloaded, and without a parent.')
    }
    this._owner = owner
    this.setContext(context)
  }

  private release(owner: object): void {
    if (this._owner !== owner) throw new Error('Scene is not owned by this manager.')
    this._owner = undefined
    this.clearContext()
  }

  protected override onDestroy(): void {
    if (this._owner !== undefined || this._parent !== undefined || this._transitioning) {
      throw new Error('Detach the node from its owner before destroying it.')
    }
    if (this.loaded) this.unload()
    this._destroying = true
    try {
      for (const child of [...this._children].reverse()) {
        if (child.loaded) child.unload()
        child._parent = undefined
        try {
          child.destroy()
        } catch (error) {
          child._parent = this
          throw error
        }
        this._children.delete(child)
        nodeSetLifecycle(this.children).deleted(child)
      }
      nodeSetLifecycle(this.children).destroy()
      if (!this.name.destroyed) this.name.destroy()
      if (!this.visible.destroyed) this.visible.destroy()
      this.tags.clear()
    } finally {
      this._destroying = false
    }
  }
}
