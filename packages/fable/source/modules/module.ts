import { type ReadOnlyStore, Store } from '../events/store.js'
import { type Identifiable } from '../interfaces/identifiable.js'
import { Destroyable } from '../primitives/destroyable.js'

/** Lifecycle states of a module. */
export enum ModuleState {
  idle = 'idle',
  starting = 'starting',
  running = 'running',
  stopping = 'stopping',
}

/** A module class used to declare and retrieve dependencies. */
export type ModuleType<TModule extends Module = Module> = abstract new (...args: never[]) => TModule

interface ModuleLifecycle {
  inject(dependencies: ReadonlyMap<ModuleType, Module>): void
  start(): void
  stop(): void
}

const lifecycles: WeakMap<Module, ModuleLifecycle> = new WeakMap<Module, ModuleLifecycle>()

/**
 * Internal lifecycle operations used by the owning game.
 *
 * @internal
 */
export function moduleLifecycle(module: Module): ModuleLifecycle {
  const lifecycle = lifecycles.get(module)
  if (lifecycle === undefined) {
    throw new Error('Module lifecycle is unavailable.')
  }
  return lifecycle
}

/**
 * A game-owned module with declared, borrowed dependencies.
 *
 * Dependencies are declared as classes and injected before startup. Each class
 * must match exactly one registered module, including subclasses. A module
 * must not destroy its dependencies. The owning game controls the lifecycle.
 */
export abstract class Module extends Destroyable implements Identifiable<string> {
  private readonly _state: Store<ModuleState> = new Store<ModuleState>(ModuleState.idle)
  private _dependencies: ReadonlyMap<ModuleType, Module> | undefined

  /** Unique identifier of the module. */
  public readonly identifier: string

  /** Classes of modules required by this module. */
  public readonly dependencies: readonly ModuleType[]

  /** Observable, read-only module state. */
  public readonly state: ReadOnlyStore<ModuleState> = this._state

  /**
   * @param identifier - Unique module identifier.
   * @param dependencies - Classes of required modules.
   */
  public constructor(identifier: string, dependencies: Iterable<ModuleType> = []) {
    super()
    this.identifier = identifier
    this.dependencies = Object.freeze([...dependencies])
    lifecycles.set(this, {
      inject: (modules) => {
        this.inject(modules)
      },
      start: () => {
        this.start()
      },
      stop: () => {
        this.stop()
      },
    })
  }

  /**
   * Gets a declared, injected dependency by its class.
   *
   * @param type - Class declared in `dependencies`.
   * @returns The borrowed dependency.
   * @throws {@link Error} If injection has not occurred or the class was not declared.
   */
  protected require<TModule extends Module>(type: ModuleType<TModule>): TModule {
    this.throwIfDestroyed()
    if (this._dependencies === undefined) {
      throw new Error(`Module '${this.identifier}' has not been injected.`)
    }
    const dependency = this._dependencies.get(type)
    if (!(dependency instanceof type)) {
      throw new Error(`Module '${this.identifier}' requires uninjected dependency '${type.name}'.`)
    }
    return dependency
  }

  /** Called on startup. If it throws, `onStop` is called for cleanup. */
  protected onStart(): void {
    // Override when startup is required.
  }

  /** Called on shutdown and to clean up incomplete startup. */
  protected onStop(): void {
    // Override when cleanup is required.
  }

  protected override onDestroy(): void {
    if (!this._state.destroyed) {
      if (this._state.value !== ModuleState.idle) {
        throw new Error(`Module '${this.identifier}' cannot be destroyed while not idle.`)
      }
      this._state.destroy()
    }
  }

  private inject(modules: ReadonlyMap<ModuleType, Module>): void {
    this.throwIfDestroyed()
    if (this._dependencies !== undefined) {
      throw new Error(`Module '${this.identifier}' has already been injected.`)
    }
    const dependencies = new Map<ModuleType, Module>()
    for (const type of this.dependencies) {
      const dependency = modules.get(type)
      if (!(dependency instanceof type)) {
        throw new Error(`Module '${this.identifier}' requires missing dependency '${type.name}'.`)
      }
      dependencies.set(type, dependency)
    }
    this._dependencies = dependencies
  }

  private start(): void {
    this.throwIfDestroyed()
    if (this._dependencies === undefined) {
      throw new Error(`Module '${this.identifier}' has not been injected.`)
    }
    if (this._state.value !== ModuleState.idle) {
      throw new Error(`Module '${this.identifier}' cannot start from state '${this._state.value}'.`)
    }

    let entered = false
    let started = false
    try {
      this._state.value = ModuleState.starting
      entered = true
      this.onStart()
      started = true
      this._state.value = ModuleState.running
    } catch (error) {
      if (started) {
        throw error
      }
      const failures: unknown[] = []
      let cleanupFailed = false
      if (entered) {
        try {
          this._state.value = ModuleState.stopping
        } catch (failure) {
          failures.push(failure)
        }
        try {
          this.onStop()
        } catch (failure) {
          cleanupFailed = true
          failures.push(failure)
        }
      }
      try {
        this._state.value = cleanupFailed ? ModuleState.running : ModuleState.idle
      } catch (failure) {
        failures.push(failure)
      }
      if (failures.length > 0) {
        throw new AggregateError([error, ...failures], 'Module startup and recovery failed.', {
          cause: error,
        })
      }
      throw error
    }
  }

  private stop(): void {
    this.throwIfDestroyed()
    if (this._dependencies === undefined || this._state.value !== ModuleState.running) {
      throw new Error(`Module '${this.identifier}' cannot stop from state '${this._state.value}'.`)
    }
    let stopped = false
    try {
      this._state.value = ModuleState.stopping
      this.onStop()
      stopped = true
      this._state.value = ModuleState.idle
    } catch (error) {
      try {
        this._state.value = stopped ? ModuleState.idle : ModuleState.running
      } catch (failure) {
        throw new AggregateError(
          [error, failure],
          'Module shutdown and state notification failed.',
          {
            cause: failure,
          },
        )
      }
      throw error
    }
  }
}
