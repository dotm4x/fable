import { type ReadOnlyStore, Store } from './events/store.js'
import { type Module, moduleLifecycle, ModuleState, type ModuleType } from './module.js'
import { Destroyable } from './primitives/destroyable.js'
import { Once } from './primitives/once.js'

/** Lifecycle states of a game. */
export enum GameState {
  idle = 'idle',
  starting = 'starting',
  running = 'running',
  stopping = 'stopping',
  failed = 'failed',
}

/**
 * Coordinates the lifecycle of its owned modules in dependency order.
 *
 * Constructor and composed modules transfer ownership to the game. Dependencies
 * are borrowed. A failed shutdown can be retried with `stop`; destruction may
 * be retried after a module's destruction fails.
 */
export abstract class Game extends Destroyable {
  private readonly _modules: Map<string, Module> = new Map<string, Module>()
  private readonly _state: Store<GameState> = new Store<GameState>(GameState.idle)
  private _order: readonly Module[] | undefined
  private readonly _preparation: Once = new Once(
    'Game preparation has already failed or is in progress.',
  )

  private _injection: 'pending' | 'ready' | 'failed' = 'pending'
  private _destroying: boolean = false
  private _transitioning: boolean = false

  /** Registered modules, indexed by identifier. The game retains ownership. */
  public readonly modules: ReadonlyMap<string, Module> = this._modules

  /** Observable, read-only game state. */
  public readonly state: ReadOnlyStore<GameState> = this._state

  /**
   * @param modules - Initial modules whose ownership is transferred to this game.
   * @throws {@link Error} If module identifiers are duplicated.
   */
  public constructor(modules: Iterable<Module> = []) {
    super()
    for (const module of modules) {
      if (this._modules.has(module.identifier)) {
        throw new Error(`Duplicate module identifier '${module.identifier}'.`)
      }

      this._modules.set(module.identifier, module)
    }
  }

  /**
   * Starts modules in dependency order and rolls back on failure.
   *
   * Each declared dependency class must match exactly one module, including
   * subclasses. Required dependencies must be present; optional dependencies
   * may be absent. Ambiguous and circular dependencies are rejected before
   * injection or startup. Lifecycle transitions cannot be reentered from
   * hooks or state notifications.
   *
   * @throws {@link Error} If the game cannot start or dependencies are invalid.
   * @throws {@link AggregateError} If startup and recovery both fail.
   */
  public start(): void {
    this.throwIfDestroyed()
    if (this._state.value !== GameState.idle || this._destroying || this._transitioning) {
      throw new Error(`Game cannot start from state '${this._state.value}'.`)
    }

    const started: Module[] = []
    this._transitioning = true
    try {
      this._state.value = GameState.starting
      this.prepare()
      const { order, dependencies } = this.resolveDependencies()
      this._order = order
      this.inject(order, dependencies)
      for (const module of order) {
        if (module.destroyed) {
          throw new Error(`Module '${module.identifier}' has already been destroyed.`)
        }

        try {
          moduleLifecycle(module).start()
        } finally {
          if (this.moduleRunning(module)) {
            started.push(module)
          }
        }
      }

      this._state.value = GameState.running
      this.onStart()
    } catch (error) {
      const failures: unknown[] = []
      for (const module of started.reverse()) {
        if (module.state.value !== ModuleState.running) {
          continue
        }

        try {
          moduleLifecycle(module).stop()
        } catch (failure) {
          failures.push(failure)
          break
        }
      }

      try {
        this._state.value = failures.length === 0 ? GameState.idle : GameState.failed
      } catch (failure) {
        failures.push(failure)
      }

      if (failures.length > 0) {
        throw new AggregateError([error, ...failures], 'Game startup and recovery failed.', {
          cause: error,
        })
      }

      throw error
    } finally {
      this._transitioning = false
    }
  }

  /**
   * Stops running modules in reverse dependency order.
   *
   * Failed shutdown leaves the game in `Failed`; call `stop` again to retry.
   * @throws {@link Error} If the game is not running or awaiting shutdown recovery.
   */
  public stop(): void {
    this.throwIfDestroyed()
    if (
      this._transitioning ||
      (this._state.value !== GameState.running && this._state.value !== GameState.failed)
    ) {
      throw new Error(`Game cannot stop from state '${this._state.value}'.`)
    }

    this._transitioning = true
    try {
      this._state.value = GameState.stopping
      const order = this._order ?? this.resolveDependencies().order
      for (const module of [...order].reverse()) {
        if (module.state.value === ModuleState.running) {
          moduleLifecycle(module).stop()
        }
      }

      this.onStop()
      this._state.value = GameState.idle
    } catch (error) {
      try {
        this._state.value = GameState.failed
      } catch (failure) {
        throw new AggregateError([error, failure], 'Game shutdown and state notification failed.', {
          cause: failure,
        })
      }

      throw error
    } finally {
      this._transitioning = false
    }
  }

  /**
   * Yields additional modules, once, before configuration.
   *
   * @returns Modules whose ownership transfers to the game.
   */
  protected *compose(): Generator<Module, void, unknown> {
    // Override and yield modules when composition is required.
  }

  /** Configures composed modules once, before dependency resolution and injection. */
  protected configure(): void {
    // Override when configuration is required.
  }

  /** Called after all modules have started and the game is running. */
  protected onStart(): void {
    // Override when startup is required.
  }

  /** Called after all modules have stopped while the game is stopping. */
  protected onStop(): void {
    // Override when shutdown is required.
  }

  /**
   * Gets a registered module by identifier.
   *
   * @param identifier - Identifier of the registered module.
   * @returns The borrowed module.
   * @throws {@link Error} If the module is not registered.
   */
  protected require(identifier: string): Module {
    this.throwIfDestroyed()
    const module = this._modules.get(identifier)
    if (module === undefined) {
      throw new Error(`Module '${identifier}' is not registered.`)
    }

    return module
  }

  protected override onDestroy(): void {
    if (this._transitioning) {
      throw new Error('Game cannot be destroyed during a lifecycle transition.')
    }

    if (!this._state.destroyed && this._state.value !== GameState.idle) {
      throw new Error(`Game cannot be destroyed while in state '${this._state.value}'.`)
    }

    this._destroying = true
    for (const module of [...(this._order ?? this._modules.values())].reverse()) {
      if (!module.destroyed) {
        module.destroy()
      }
    }

    this._modules.clear()
    if (!this._state.destroyed) {
      this._state.destroy()
    }
  }

  private prepare(): void {
    this._preparation.execute(() => {
      for (const module of this.compose()) {
        const existing = this._modules.get(module.identifier)
        if (existing !== undefined) {
          const error = new Error(`Duplicate module identifier '${module.identifier}'.`)
          if (existing !== module && !module.destroyed) {
            try {
              module.destroy()
            } catch (failure) {
              throw new AggregateError([error, failure], 'Duplicate module cleanup failed.', {
                cause: failure,
              })
            }
          }

          throw error
        }

        this._modules.set(module.identifier, module)
      }

      this.configure()
    })
  }

  private inject(
    order: readonly Module[],
    dependencies: ReadonlyMap<Module, ReadonlyMap<ModuleType, Module>>,
  ): void {
    if (this._injection === 'ready') {
      return
    }

    if (this._injection === 'failed') {
      throw new Error('Game module injection has already failed.')
    }

    try {
      for (const module of order) {
        const resolved = dependencies.get(module)
        if (resolved === undefined) {
          throw new Error(`Dependencies for module '${module.identifier}' have not been resolved.`)
        }

        moduleLifecycle(module).inject(resolved)
      }

      this._injection = 'ready'
    } catch (error) {
      this._injection = 'failed'
      throw error
    }
  }

  private moduleRunning(module: Module): boolean {
    return !module.destroyed && module.state.value === ModuleState.running
  }

  private resolveDependencies(): {
    order: Module[]
    dependencies: Map<Module, ReadonlyMap<ModuleType, Module>>
  } {
    const sorted: Module[] = []
    const dependencies = new Map<Module, ReadonlyMap<ModuleType, Module>>()
    const visiting = new Set<string>()
    const visited = new Set<string>()
    const visit = (module: Module, path: readonly string[]): void => {
      if (visiting.has(module.identifier)) {
        throw new Error(`Circular module dependency: ${[...path, module.identifier].join(' -> ')}.`)
      }

      if (visited.has(module.identifier)) {
        return
      }

      visiting.add(module.identifier)
      const resolved = new Map<ModuleType, Module>()
      for (const { type, optional } of module.dependencies) {
        const matches = [...this._modules.values()].filter((candidate) => candidate instanceof type)
        if (matches.length === 0) {
          if (optional) continue
          throw new Error(
            `Module '${module.identifier}' requires missing dependency '${type.name}'.`,
          )
        }

        if (matches.length > 1) {
          throw new Error(
            `Module '${module.identifier}' has ambiguous dependency '${type.name}': ${matches.map((match) => match.identifier).join(', ')}.`,
          )
        }

        const dependency = matches[0]
        if (dependency === undefined) {
          throw new Error(`Dependency '${type.name}' could not be resolved.`)
        }

        resolved.set(type, dependency)
        visit(dependency, [...path, module.identifier])
      }

      dependencies.set(module, resolved)
      visiting.delete(module.identifier)
      visited.add(module.identifier)
      sorted.push(module)
    }

    for (const module of this._modules.values()) {
      visit(module, [])
    }

    return { order: sorted, dependencies }
  }
}
