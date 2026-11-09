import { ReactiveSet } from '#core/collections/reactive-set.js'
import { type Identifiable } from '#core/interfaces/identifiable.js'
import { Destroyable } from '#core/primitives/destroyable.js'
import { Once } from '#core/primitives/once.js'

import { type UpdateContext } from '../context.js'
import { type Updatable } from '../interfaces/updatable.js'

/** Higher-priority channels are updated first. */
export enum ChannelPriority {
  low,
  normal,
  high,
  critical,
}

/** Configuration for an update channel. */
export interface ChannelOptions {
  /** Unique channel identifier. */
  readonly identifier: string
  /** Target updates per second; non-positive means unlimited. Defaults to zero. */
  readonly targetUpdateRate?: number
  /** Channel update priority; defaults to normal. */
  readonly priority?: ChannelPriority
  /** Initial borrowed entries. */
  readonly entries?: Iterable<Updatable>
}

/**
 * A prioritized collection of borrowed updatables.
 *
 * A channel updates at most once per scheduler iteration. Entries are never
 * destroyed by the channel, including entries returned by {@link compose}.
 */
export class Channel extends Destroyable implements Identifiable<string> {
  private readonly _preparation: Once = new Once(
    'Channel preparation has already failed or is in progress.',
  )
  private _elapsed: number = 0
  private _phase: number = 0
  private _deltaTime: number = 0

  /** Borrowed entries, updated in insertion order using a snapshot. */
  public readonly entries: ReactiveSet<Updatable>

  /** Unique channel identifier. */
  public readonly identifier: string

  /** Target updates per second. */
  public readonly targetUpdateRate: number

  /** Channel update priority. */
  public readonly priority: ChannelPriority

  /**
   * @param options - Channel configuration.
   * @throws {@link RangeError} If the target rate or priority is not finite.
   */
  public constructor({
    identifier,
    targetUpdateRate = 0,
    priority = ChannelPriority.normal,
    entries = [],
  }: ChannelOptions) {
    super()
    if (!Number.isFinite(targetUpdateRate) || !Number.isFinite(priority)) {
      throw new RangeError('Channel target rate and priority must be finite.')
    }
    this.identifier = identifier
    this.targetUpdateRate = targetUpdateRate
    this.priority = priority
    this.entries = new ReactiveSet(entries)
  }

  /** Elapsed time in seconds reported by the latest channel update. */
  public get deltaTime(): number {
    return this._deltaTime
  }

  /** Instantaneous rate of the latest channel update, or zero when its delta is zero. */
  public get updateRate(): number {
    return this._deltaTime > 0 ? 1 / this._deltaTime : 0
  }

  /** Yields borrowed entries to register once before configuration. */
  protected *compose(): Generator<Updatable, void, unknown> {
    // Override to yield entries.
  }

  /** Configures the channel once after all composed entries are registered. */
  protected configure(): void {
    // Override to configure the channel.
  }

  /** Called after the entries have been updated. */
  protected onUpdate(context: UpdateContext): void {
    if (!Number.isFinite(context.deltaTime)) {
      throw new RangeError('Channel update delta must be finite.')
    }
  }

  /**
   * Prepares the channel once. Failed preparation cannot be retried.
   *
   * @throws {@link Error} If preparation fails or the channel has been destroyed.
   */
  public prepare(): void {
    this.throwIfDestroyed()
    this._preparation.execute(() => {
      const entries = [...this.compose()]
      const unique = new Set(entries)
      if (unique.size !== entries.length || entries.some((entry) => this.entries.has(entry))) {
        throw new Error('Duplicate composed object found.')
      }
      for (const entry of entries) {
        this.entries.add(entry)
      }
      this.configure()
    })
  }

  /**
   * Advances the channel by elapsed scheduler time, in seconds.
   *
   * The effective target is the lower positive channel or scheduler target.
   * Non-positive targets are unlimited. The scheduler is responsible for
   * pacing its own target; the channel only paces a lower channel target.
   * Rate-limited updates report elapsed time since the preceding channel
   * update and do not replay missed ticks.
   *
   * @param deltaTime - Finite, non-negative elapsed time in seconds.
   * @param schedulerTargetUpdateRate - Scheduler target, or zero if unlimited.
   * @throws {@link RangeError} If timing values are invalid.
   */
  public update(deltaTime: number, schedulerTargetUpdateRate: number = 0): void {
    this.throwIfDestroyed()
    if (
      !Number.isFinite(deltaTime) ||
      deltaTime < 0 ||
      !Number.isFinite(schedulerTargetUpdateRate)
    ) {
      throw new RangeError(
        'Channel timing values must be finite and delta time must be non-negative.',
      )
    }
    this.prepare()
    const channelRate = this.targetUpdateRate > 0 ? this.targetUpdateRate : 0
    const schedulerRate = schedulerTargetUpdateRate > 0 ? schedulerTargetUpdateRate : 0
    const rate =
      channelRate > 0 && schedulerRate > 0
        ? Math.min(channelRate, schedulerRate)
        : Math.max(channelRate, schedulerRate)

    this._elapsed += deltaTime
    if (channelRate > 0 && (schedulerRate === 0 || channelRate < schedulerRate)) {
      const interval = 1 / channelRate
      this._phase += deltaTime
      if (this._phase < interval) {
        return
      }
      this._phase %= interval
    }
    const context: UpdateContext = { deltaTime: this._elapsed, updateRate: rate }
    this._elapsed = 0
    this._deltaTime = context.deltaTime
    for (const entry of [...this.entries]) {
      entry.update(context)
    }
    this.onUpdate(context)
  }

  protected override onDestroy(): void {
    this.entries.clear()
    this._elapsed = 0
    this._phase = 0
  }
}
