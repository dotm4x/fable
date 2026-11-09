import { type ReadOnlyStore, Store } from '#core/events/store.js'
import { Module, type ModuleDependency, ModuleState, type ModuleType } from '#core/module.js'
import { Once } from '#core/primitives/once.js'

import { Logger } from '../logger/logger.js'

import { type Node, type NodeContext, nodeOwnership } from './node.js'

/** Configuration for a scene manager. */
export interface SceneManagerOptions {
  /** Initial scene whose ownership transfers to the manager. */
  readonly initial: Node
  /** Additional scenes whose ownership transfers to the manager. */
  readonly scenes?: Iterable<Node>
  /** Dependencies accessible to managed nodes. Logger is optional by default. */
  readonly dependencies?: Iterable<ModuleDependency>
}

/**
 * Owns named root nodes and loads the selected scene while the module runs.
 * Scene keys are captured from their initial names and remain stable on rename.
 */
export class SceneManager extends Module {
  private readonly _scenes: Map<string, Node> = new Map<string, Node>()
  private readonly _activeScene: Store<Node>
  private readonly _preparation: Once = new Once(
    'Scene manager preparation has already failed or is in progress.',
  )
  private readonly _context: NodeContext
  private _switching: boolean = false
  private _recovery: boolean = false
  private _rollbackNodes: readonly Node[] = []

  /** Registered scenes, indexed by their stable registration name. */
  public get scenes(): ReadonlyMap<string, Node> {
    return new Map(this._scenes)
  }
  /** Currently selected scene. */
  public readonly activeScene: ReadOnlyStore<Node>

  public constructor({ initial, scenes = [], dependencies = [] }: SceneManagerOptions) {
    const declared = [...dependencies]
    if (!declared.some((dependency) => dependency.type === Logger)) {
      declared.push({ type: Logger, optional: true })
    }
    super({ identifier: 'org.js.fable.SceneManager', dependencies: declared })
    this._context = {
      require: <TModule extends Module>(type: ModuleType<TModule>): TModule => this.require(type),
      optional: <TModule extends Module>(type: ModuleType<TModule>): TModule | undefined =>
        this.optional(type),
    }
    this._activeScene = new Store(initial)
    this.activeScene = this._activeScene
    try {
      this.add(initial)
      for (const scene of scenes) this.add(scene)
    } catch (error) {
      for (const scene of this._scenes.values()) nodeOwnership(scene).release(this)
      this._scenes.clear()
      this._activeScene.destroy()
      throw error
    }
  }

  /** Registers a root scene, transferring ownership to this manager. */
  public add(scene: Node): void {
    this.throwIfDestroyed()
    const key = scene.name.value
    if (!key.trim()) throw new Error('Scene name must not be empty.')
    if (this._scenes.has(key)) throw new Error(`Duplicate scene '${key}'.`)
    nodeOwnership(scene).claim(this, this._context)
    this._scenes.set(key, scene)
  }

  /** Removes an inactive, unloaded scene and returns its ownership to the caller. */
  public remove(identifier: string): Node {
    this.throwIfDestroyed()
    if (this._switching) throw new Error('Cannot remove a scene during a switch.')
    const scene = this._scenes.get(identifier)
    if (scene === undefined) throw new Error(`Scene '${identifier}' does not exist.`)
    if (scene === this._activeScene.value || scene.loaded) {
      throw new Error('Cannot remove an active or loaded scene.')
    }
    this._scenes.delete(identifier)
    nodeOwnership(scene).release(this)
    return scene
  }

  /** Yields additional owned scenes once before configuration. */
  protected *compose(): Generator<Node, void, unknown> {
    // Override to yield scenes.
  }

  /** Configures the manager once after scenes are registered. */
  protected configure(): void {
    // Override to configure scenes.
  }

  protected override onStart(): void {
    this._preparation.execute(() => {
      for (const scene of this.compose()) {
        try {
          this.add(scene)
        } catch (error) {
          try {
            nodeOwnership(scene).destroyIfUnowned()
          } catch (failure) {
            throw new AggregateError([error, failure], 'Scene composition and cleanup failed.', {
              cause: failure,
            })
          }
          throw error
        }
      }
      this.configure()
    })
    this._activeScene.value.load()
  }

  protected override onStop(): void {
    for (const node of this._rollbackNodes) {
      if (node.loaded) node.unload()
    }
    this._rollbackNodes = []
    for (const scene of [...this._scenes.values()].reverse()) {
      if (scene.loaded) scene.unload()
    }
    this._recovery = false
  }

  /**
   * Selects a registered scene; when running, unloads the current scene and
   * loads the next one. A failed switch attempts to restore the previous scene.
   */
  public switch(identifier: string): void {
    this.throwIfDestroyed()
    if (this._switching || this._recovery)
      throw new Error('Scene switching is unavailable during a transition or recovery.')
    const next = this._scenes.get(identifier)
    if (next === undefined) throw new Error(`Scene '${identifier}' does not exist.`)
    const current = this._activeScene.value
    if (current === next) return
    const state = this.state.value
    if (state !== ModuleState.idle && state !== ModuleState.running) {
      throw new Error(`Cannot switch scenes while module is '${state}'.`)
    }
    this._switching = true
    const previouslyLoaded = new Set(
      [next, ...next.descendants(true)].filter((node) => node.loaded),
    )
    try {
      if (state === ModuleState.running) {
        try {
          current.unload()
        } catch (error) {
          this._recovery = true
          throw error
        }
      }
      try {
        if (state === ModuleState.running) next.load()
        this._activeScene.value = next
      } catch (error) {
        const failures: unknown[] = []
        const rollback = [next, ...next.descendants(true)]
          .reverse()
          .filter((node) => node.loaded && !previouslyLoaded.has(node))
        for (const node of rollback) {
          if (!node.loaded) continue
          try {
            node.unload()
          } catch (failure) {
            failures.push(failure)
            this._rollbackNodes = rollback
            break
          }
        }
        try {
          this._activeScene.value = current
        } catch (failure) {
          failures.push(failure)
        }
        if (state === ModuleState.running && !current.loaded) {
          try {
            current.load()
          } catch (failure) {
            failures.push(failure)
          }
        }
        if (failures.length > 0) {
          this._recovery = true
          throw new AggregateError([error, ...failures], 'Scene switching and recovery failed.', {
            cause: error,
          })
        }
        throw error
      }
    } finally {
      this._switching = false
    }
  }

  protected override onDestroy(): void {
    if (this._switching || (!this.state.destroyed && this.state.value !== ModuleState.idle)) {
      throw new Error('Scene manager cannot be destroyed during a transition or while running.')
    }
    for (const [key, scene] of this._scenes) {
      if (!scene.destroyed) nodeOwnership(scene).destroy(this)
      this._scenes.delete(key)
    }
    if (!this._activeScene.destroyed) this._activeScene.destroy()
    super.onDestroy()
  }
}
