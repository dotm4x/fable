import { IdentifiableSet } from '#core/collections/identifiable-set.js'
import { Module, ModuleState } from '#core/module.js'
import { Once } from '#core/primitives/once.js'

import { type Channel } from './channels/channel.js'

/** Configuration for the browser scheduler. */
export interface SchedulerOptions {
  /** Maximum iterations per second; non-positive means no additional limit. Defaults to 60. */
  readonly targetUpdateRate?: number
  /** Initial channels whose ownership transfers to the scheduler. */
  readonly channels?: Iterable<Channel>
  /** Maximum elapsed time reported per iteration, in seconds. Defaults to 0.25. */
  readonly maximumDeltaTime?: number
}

/**
 * Owns prioritized channels and drives them with browser animation frames.
 *
 * Start the owning game before calling {@link run}. Stopping the game cancels
 * the loop; a later start requires another call to `run`.
 */
export class Scheduler extends Module {
  private readonly _preparation: Once = new Once(
    'Scheduler preparation has already failed or is in progress.',
  )
  private _frame: number | undefined
  private _looping: boolean = false
  private _generation: number = 0
  private _previousTime: number | undefined
  private _elapsed: number = 0
  private _phase: number = 0
  private _deltaTime: number = 0

  /**
   * Channels owned by the scheduler. Adding transfers ownership; deleting or
   * clearing returns ownership to the caller without destroying the channel.
   */
  public readonly channels: IdentifiableSet<Channel>

  /** Maximum iterations per second. */
  public readonly targetUpdateRate: number

  /** Maximum elapsed time reported per iteration, in seconds. */
  public readonly maximumDeltaTime: number

  /**
   * @param options - Scheduler configuration.
   * @throws {@link RangeError} If the target rate or maximum delta is invalid.
   */
  public constructor({
    targetUpdateRate = 60,
    channels = [],
    maximumDeltaTime = 0.25,
  }: SchedulerOptions = {}) {
    super({ identifier: 'org.js.fable.Scheduler' })
    if (
      !Number.isFinite(targetUpdateRate) ||
      !Number.isFinite(maximumDeltaTime) ||
      maximumDeltaTime <= 0
    ) {
      throw new RangeError(
        'Scheduler target rate must be finite and maximum delta time must be finite and positive.',
      )
    }
    this.targetUpdateRate = targetUpdateRate
    this.maximumDeltaTime = maximumDeltaTime
    this.channels = new IdentifiableSet(channels)
  }

  /** Elapsed time in seconds reported by the latest scheduler iteration. */
  public get deltaTime(): number {
    return this._deltaTime
  }

  /** Whether the animation-frame loop is active. */
  public get looping(): boolean {
    return this._looping
  }

  /** Yields channels whose ownership transfers to this scheduler. */
  protected *compose(): Generator<Channel, void, unknown> {
    // Override to yield channels.
  }

  /** Configures channels once after composition. */
  protected configure(): void {
    // Override to configure the scheduler.
  }

  protected override onStart(): void {
    this._preparation.execute(() => {
      for (const channel of this.compose()) {
        const existing = this.channels.get(channel.identifier)
        if (existing !== undefined) {
          const error = new Error(`Duplicate channel identifier '${channel.identifier}'.`)
          if (existing !== channel && !channel.destroyed) {
            try {
              channel.destroy()
            } catch (failure) {
              throw new AggregateError([error, failure], 'Duplicate channel cleanup failed.', {
                cause: failure,
              })
            }
          }
          throw error
        }
        this.channels.add(channel)
      }
      this.configure()
    })
    for (const channel of this.channels) {
      channel.prepare()
    }
  }

  protected override onStop(): void {
    this.stopLoop()
  }

  protected override onDestroy(): void {
    if (!this.state.destroyed && this.state.value !== ModuleState.idle) {
      throw new Error(`Module '${this.identifier}' cannot be destroyed while not idle.`)
    }
    for (const channel of this.channels) {
      if (!channel.destroyed) {
        channel.destroy()
      }
    }
    this.channels.clear()
    super.onDestroy()
  }

  /**
   * Starts the non-blocking animation-frame loop.
   *
   * A callback failure stops the loop and propagates an error identifying the
   * channel to the browser. The game remains running and can be stopped by its
   * owner. Frame delivery is limited by the browser and may pause in background tabs.
   *
   * @throws {@link Error} If the scheduler is not running, the loop is already active,
   * or animation frames are unavailable.
   */
  public run(): void {
    this.throwIfDestroyed()
    if (this.state.value !== ModuleState.running || this._looping) {
      throw new Error('Scheduler must be running and its loop must not already be active.')
    }
    if (typeof requestAnimationFrame !== 'function' || typeof cancelAnimationFrame !== 'function') {
      throw new Error('Animation frames are not available in this environment.')
    }
    this._previousTime = undefined
    this._elapsed = 0
    this._phase = 0
    this._looping = true
    const generation = ++this._generation
    try {
      this._frame = requestAnimationFrame((time) => {
        this.tick(time, generation)
      })
    } catch (error) {
      this.stopLoop()
      throw error
    }
  }

  private stopLoop(): void {
    this._looping = false
    this._generation++
    if (this._frame !== undefined) {
      cancelAnimationFrame(this._frame)
      this._frame = undefined
    }
    this._previousTime = undefined
    this._elapsed = 0
    this._phase = 0
  }

  private loopActive(generation: number): boolean {
    return this._looping && generation === this._generation
  }

  private tick(time: number, generation: number): void {
    if (!this.loopActive(generation)) {
      return
    }
    this._frame = undefined
    try {
      if (this._previousTime !== undefined) {
        const elapsed = Math.max(0, (time - this._previousTime) / 1000)
        this._elapsed += elapsed
        this._phase += elapsed
        const interval = this.targetUpdateRate > 0 ? 1 / this.targetUpdateRate : 0
        if (interval === 0 || this._phase >= interval) {
          this._phase = interval > 0 ? this._phase % interval : 0
          this._deltaTime = Math.min(this._elapsed, this.maximumDeltaTime)
          this._elapsed = 0
          const channels = [...this.channels].sort((left, right) => right.priority - left.priority)
          for (const channel of channels) {
            if (!this.loopActive(generation)) {
              break
            }
            if (this.channels.get(channel.identifier) !== channel) {
              continue
            }
            try {
              channel.update(this._deltaTime, this.targetUpdateRate)
            } catch (error) {
              throw new Error(`Update channel '${channel.identifier}' failed.`, { cause: error })
            }
          }
        }
      }
      if (this.loopActive(generation)) {
        this._previousTime = time
        this._frame = requestAnimationFrame((nextTime) => {
          this.tick(nextTime, generation)
        })
      }
    } catch (error) {
      if (generation === this._generation) {
        this.stopLoop()
      }
      throw error
    }
  }
}
