import { afterEach, describe, expect, it, vi } from 'vitest'

import { Channel, ChannelPriority, Game, TimeModule } from '../../../source/index.js'

class TestGame extends Game {}

function animationFrames(): {
  frame(time: number): void
  pending(): number
} {
  let nextId = 0
  const callbacks = new Map<number, FrameRequestCallback>()
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback): number => {
    const id = ++nextId
    callbacks.set(id, callback)
    return id
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number): void => {
    callbacks.delete(id)
  })
  return {
    frame: (time) => {
      const callback = callbacks.values().next().value
      if (callback === undefined) {
        throw new Error('No animation frame is pending.')
      }

      callbacks.clear()
      callback(time)
    },
    pending: () => callbacks.size,
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('TimeModule', () => {
  it('uses defaults and accepts individually configured options', () => {
    const defaults = new TimeModule()
    expect(defaults.targetUpdateRate).toBe(60)
    expect(defaults.maximumDeltaTime).toBe(0.25)
    expect(defaults.channels.size).toBe(0)
    const configured = new TimeModule({ maximumDeltaTime: 0.1 })
    expect(configured.targetUpdateRate).toBe(60)
    expect(configured.maximumDeltaTime).toBe(0.1)
  })

  it('runs explicitly, orders channels, limits delta, and cancels on stop', () => {
    const frames = animationFrames()
    const calls: string[] = []
    const low = new Channel({
      identifier: 'low',
      targetUpdateRate: 0,
      priority: ChannelPriority.low,
      entries: [
        {
          update: () => {
            calls.push('low')
          },
        },
      ],
    })
    const high = new Channel({
      identifier: 'high',
      targetUpdateRate: 0,
      priority: ChannelPriority.high,
      entries: [
        {
          update: () => {
            calls.push('high')
          },
        },
      ],
    })
    const scheduler = new TimeModule({
      targetUpdateRate: 0,
      channels: [low, high],
      maximumDeltaTime: 0.25,
    })
    const game = new TestGame([scheduler])
    expect(() => {
      scheduler.run()
    }).toThrow('running')
    game.start()
    expect(frames.pending()).toBe(0)
    scheduler.run()
    expect(() => {
      scheduler.run()
    }).toThrow('already')
    frames.frame(0)
    frames.frame(1000)
    expect(calls).toEqual(['high', 'low'])
    expect(scheduler.deltaTime).toBe(0.25)
    expect(high.deltaTime).toBe(0.25)
    game.stop()
    expect(scheduler.looping).toBe(false)
    expect(frames.pending()).toBe(0)
    game.destroy()
    expect(high.destroyed).toBe(true)
    expect(low.destroyed).toBe(true)
  })

  it('paces iterations without blocking and resets the clock after restarting', () => {
    const frames = animationFrames()
    const update = vi.fn()
    const scheduler = new TimeModule({
      targetUpdateRate: 2,
      channels: [
        new Channel({
          identifier: 'channel',
          targetUpdateRate: 0,
          priority: ChannelPriority.normal,
          entries: [{ update }],
        }),
      ],
    })
    const game = new TestGame([scheduler])
    game.start()
    scheduler.run()
    frames.frame(0)
    frames.frame(200)
    expect(update).not.toHaveBeenCalled()
    frames.frame(500)
    expect(update).toHaveBeenCalledOnce()
    game.stop()
    game.start()
    scheduler.run()
    frames.frame(10000)
    frames.frame(10200)
    expect(update).toHaveBeenCalledOnce()
    game.stop()
    game.destroy()
  })

  it('stops and propagates update errors with channel context', () => {
    const frames = animationFrames()
    const failure = new Error('update failed')
    const channel = new Channel({
      identifier: 'broken',
      targetUpdateRate: 0,
      priority: ChannelPriority.normal,
      entries: [
        {
          update: () => {
            throw failure
          },
        },
      ],
    })
    const scheduler = new TimeModule({ targetUpdateRate: 0, channels: [channel] })
    const game = new TestGame([scheduler])
    game.start()
    scheduler.run()
    frames.frame(0)
    try {
      frames.frame(16)
      throw new Error('Expected the update to fail.')
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      expect(error).toMatchObject({ message: "Update channel 'broken' failed.", cause: failure })
    }

    expect(scheduler.looping).toBe(false)
    expect(frames.pending()).toBe(0)
    game.stop()
    game.destroy()
  })

  it('composes once and prepares channels added after start', () => {
    const frames = animationFrames()
    const composed = new Channel({ identifier: 'composed' })
    class TestTimeModule extends TimeModule {
      public count: number = 0
      protected override *compose(): Generator<Channel> {
        this.count++
        yield composed
      }
    }
    const scheduler = new TestTimeModule({ targetUpdateRate: 0 })
    const game = new TestGame([scheduler])
    game.start()
    game.stop()
    game.start()
    expect(scheduler.count).toBe(1)
    const update = vi.fn()
    const added = new Channel({
      identifier: 'added',
      targetUpdateRate: 0,
      priority: ChannelPriority.normal,
      entries: [{ update }],
    })
    scheduler.channels.add(added)
    scheduler.run()
    frames.frame(0)
    frames.frame(16)
    expect(update).toHaveBeenCalledOnce()
    scheduler.channels.delete(added)
    game.stop()
    game.destroy()
    expect(added.destroyed).toBe(false)
    added.destroy()
  })

  it('does not destroy channels while running and rejects invalid settings', () => {
    expect(() => new TimeModule({ targetUpdateRate: NaN })).toThrow(RangeError)
    expect(
      () => new TimeModule({ targetUpdateRate: 60, channels: [], maximumDeltaTime: 0 }),
    ).toThrow(RangeError)
    const channel = new Channel({ identifier: 'channel' })
    const scheduler = new TimeModule({ targetUpdateRate: 0, channels: [channel] })
    const game = new TestGame([scheduler])
    game.start()
    expect(() => {
      scheduler.destroy()
    }).toThrow('not idle')
    expect(channel.destroyed).toBe(false)
    game.stop()
    game.destroy()
  })

  it('stops dispatch immediately if a callback stops the game', () => {
    const frames = animationFrames()
    const later = vi.fn()
    const first = new Channel({
      identifier: 'first',
      targetUpdateRate: 0,
      priority: ChannelPriority.high,
      entries: [
        {
          update: () => {
            game.stop()
          },
        },
      ],
    })
    const second = new Channel({
      identifier: 'second',
      targetUpdateRate: 0,
      priority: ChannelPriority.low,
      entries: [{ update: later }],
    })
    const scheduler = new TimeModule({ targetUpdateRate: 0, channels: [first, second] })
    const game = new TestGame([scheduler])
    game.start()
    scheduler.run()
    frames.frame(0)
    frames.frame(20)
    expect(later).not.toHaveBeenCalled()
    expect(frames.pending()).toBe(0)
    game.destroy()
  })

  it('can retry destruction when a derived hook fails after base cleanup', () => {
    class LateFailure extends TimeModule {
      private _failed: boolean = false
      protected override onDestroy(): void {
        super.onDestroy()
        if (!this._failed) {
          this._failed = true
          throw new Error('late failure')
        }
      }
    }
    const scheduler = new LateFailure()
    expect(() => {
      scheduler.destroy()
    }).toThrow('late failure')
    scheduler.destroy()
    expect(scheduler.destroyed).toBe(true)
  })

  it('fails explicitly when animation frames are unavailable', () => {
    vi.stubGlobal('requestAnimationFrame', undefined)
    vi.stubGlobal('cancelAnimationFrame', undefined)
    const scheduler = new TimeModule()
    const game = new TestGame([scheduler])
    game.start()
    expect(() => {
      scheduler.run()
    }).toThrow('not available')
    expect(scheduler.looping).toBe(false)
    game.stop()
    game.destroy()
  })
})
