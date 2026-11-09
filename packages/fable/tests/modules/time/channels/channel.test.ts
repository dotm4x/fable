import { describe, expect, it, vi } from 'vitest'

import {
  Channel,
  ChannelPriority,
  type Updatable,
  type UpdateContext,
} from '../../../../source/index.js'

describe('Channel', () => {
  it('uses defaults and accepts individually configured options', () => {
    const defaults = new Channel({ identifier: 'defaults' })
    expect(defaults.targetUpdateRate).toBe(0)
    expect(defaults.priority).toBe(ChannelPriority.normal)
    expect(defaults.entries.size).toBe(0)

    const entry: Updatable = { update: vi.fn() }
    const configured = new Channel({ identifier: 'configured', entries: [entry] })
    expect(configured.entries.has(entry)).toBe(true)
    expect(configured.priority).toBe(ChannelPriority.normal)
  })

  it('updates borrowed entries and hook using the channel context', () => {
    const calls: string[] = []
    const contexts: UpdateContext[] = []
    const entry: Updatable = {
      update: (context) => {
        contexts.push(context)
        calls.push('entry')
      },
    }
    class TestChannel extends Channel {
      protected override onUpdate(): void {
        calls.push('channel')
      }
    }
    const channel = new TestChannel({
      identifier: 'update',
      targetUpdateRate: 0,
      priority: ChannelPriority.high,
      entries: [entry],
    })
    channel.update(0.1)
    expect(contexts).toEqual([{ deltaTime: 0.1, updateRate: 0 }])
    expect(channel.deltaTime).toBe(0.1)
    expect(channel.updateRate).toBe(10)
    expect(calls).toEqual(['entry', 'channel'])
    channel.destroy()
    expect(channel.entries.size).toBe(0)
    expect(() => {
      channel.update(0.1)
    }).toThrow('destroyed')
  })

  it('caps the rate and reports elapsed time without double counting remainder', () => {
    const update = vi.fn<(context: UpdateContext) => void>()
    const channel = new Channel({
      identifier: 'limited',
      targetUpdateRate: 2,
      priority: ChannelPriority.normal,
      entries: [{ update }],
    })
    channel.update(0.3, 10)
    expect(update).not.toHaveBeenCalled()
    channel.update(0.3, 10)
    channel.update(0.2, 10)
    channel.update(0.2, 10)
    expect(update).toHaveBeenCalledTimes(2)
    expect(update.mock.calls[0]?.[0]).toEqual({ deltaTime: 0.6, updateRate: 2 })
    expect(update.mock.calls[1]?.[0].deltaTime).toBeCloseTo(0.4)
    expect(update.mock.calls[1]?.[0].updateRate).toBe(2)

    const capped = vi.fn()
    const other = new Channel({
      identifier: 'capped',
      targetUpdateRate: 10,
      priority: ChannelPriority.normal,
      entries: [{ update: capped }],
    })
    other.update(0.25, 4)
    expect(capped).toHaveBeenCalledWith({ deltaTime: 0.25, updateRate: 4 })
  })

  it('prepares once, detects duplicate composed entries and retains failure', () => {
    const entry: Updatable = { update: vi.fn() }
    class TestChannel extends Channel {
      public count: number = 0
      protected override *compose(): Generator<Updatable> {
        this.count++
        yield entry
      }
    }
    const channel = new TestChannel({ identifier: 'channel' })
    channel.prepare()
    channel.prepare()
    expect(channel.count).toBe(1)
    expect(channel.entries.has(entry)).toBe(true)
    const duplicate = new TestChannel({
      identifier: 'duplicate',
      targetUpdateRate: 0,
      priority: ChannelPriority.normal,
      entries: [entry],
    })
    expect(() => {
      duplicate.prepare()
    }).toThrow('Duplicate')
    expect(() => {
      duplicate.prepare()
    }).toThrow('preparation')
    expect(duplicate.count).toBe(1)
  })

  it('uses a snapshot when entries change during updates', () => {
    const calls: string[] = []
    const second: Updatable = {
      update: () => {
        calls.push('second')
      },
    }
    const channel = new Channel({ identifier: 'channel' })
    channel.entries.add({
      update: () => {
        calls.push('first')
        channel.entries.delete(second)
      },
    })
    channel.entries.add(second)
    channel.update(1)
    channel.update(1)
    expect(calls).toEqual(['first', 'second', 'first'])
  })

  it('rejects invalid timing inputs', () => {
    expect(() => new Channel({ identifier: 'invalid', targetUpdateRate: NaN })).toThrow(RangeError)
    const channel = new Channel({ identifier: 'channel' })
    expect(() => {
      channel.update(-1)
    }).toThrow(RangeError)
    expect(() => {
      channel.update(Infinity)
    }).toThrow(RangeError)
    expect(() => {
      channel.update(0, NaN)
    }).toThrow(RangeError)
  })
})
