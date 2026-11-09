import { describe, expect, expectTypeOf, it, vi } from 'vitest'

import { ReactiveSet, type ReadOnlySignal } from '../../../source/index.js'

describe('ReactiveSet', () => {
  it('exposes read-only signals and permits disconnecting subscriptions', () => {
    expectTypeOf<ReactiveSet<number>['onAdd']>().toEqualTypeOf<ReadOnlySignal<[value: number]>>()
    expectTypeOf<ReactiveSet<number>['onDelete']>().toEqualTypeOf<ReadOnlySignal<[value: number]>>()

    const set = new ReactiveSet<number>()
    const callback = vi.fn()
    const connection = set.onAdd.connect(callback)

    set.add(1)
    connection.disconnect()
    set.add(2)

    expect(callback).toHaveBeenCalledExactlyOnceWith(1)
  })

  it('supports ordinary set operations and emits only for changes', () => {
    const set = new ReactiveSet([1, 2])
    const onAdd = vi.fn()
    const onDelete = vi.fn()
    set.onAdd.connect(onAdd)
    set.onDelete.connect(onDelete)

    expect(set).toBeInstanceOf(Set)
    expect(set.add(2)).toBe(set)
    expect(set.add(3)).toBe(set)
    expect(set.delete(5)).toBe(false)
    expect(set.delete(1)).toBe(true)
    expect([...set]).toEqual([2, 3])
    expect(onAdd).toHaveBeenCalledOnce()
    expect(onAdd).toHaveBeenCalledWith(3)
    expect(onDelete).toHaveBeenCalledOnce()
    expect(onDelete).toHaveBeenCalledWith(1)
  })

  it('clears all values before notifying, without removing values added by callbacks', () => {
    const set = new ReactiveSet([1, 2])
    const deleted: number[] = []
    set.onDelete.connect((value) => {
      deleted.push(value)
      if (value === 1) {
        expect(set.size).toBe(0)
        set.add(3)
      }
    })

    set.clear()

    expect(deleted).toEqual([1, 2])
    expect([...set]).toEqual([3])
  })

  it('supports undefined and tuple values without expanding them', () => {
    const set = new ReactiveSet<undefined | [number, number]>()
    const onAdd = vi.fn()
    set.onAdd.connect(onAdd)
    const tuple: [number, number] = [1, 2]

    set.add(undefined)
    set.add(tuple)

    expect(onAdd).toHaveBeenNthCalledWith(1, undefined)
    expect(onAdd).toHaveBeenNthCalledWith(2, tuple)
  })

  it('accepts any iterable as its initial values', () => {
    const set = new ReactiveSet(new Set([1, 2]))
    expect([...set]).toEqual([1, 2])
  })

  it('uses native set equality and propagates callback errors after mutation', () => {
    const set = new ReactiveSet([NaN])
    const callback = vi.fn()
    set.onAdd.connect(callback)
    set.add(NaN)
    expect(callback).not.toHaveBeenCalled()

    set.onDelete.connect(() => {
      throw new Error('listener failed')
    })
    expect(() => set.delete(NaN)).toThrow('listener failed')
    expect(set.has(NaN)).toBe(false)
  })
})
