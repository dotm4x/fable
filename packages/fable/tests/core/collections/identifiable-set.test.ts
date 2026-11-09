import { describe, expect, expectTypeOf, it, vi } from 'vitest'

import { type Identifiable, IdentifiableSet, type ReadOnlySignal } from '../../../source/index.js'

interface Item extends Identifiable<string> {
  readonly name: string
}

describe('IdentifiableSet', () => {
  it('indexes objects by identifier and emits read-only add and delete signals', () => {
    expectTypeOf<IdentifiableSet<Item>['onAdd']>().toEqualTypeOf<ReadOnlySignal<[value: Item]>>()
    expectTypeOf<IdentifiableSet<Item>['onDelete']>().toEqualTypeOf<ReadOnlySignal<[value: Item]>>()
    expectTypeOf<Parameters<IdentifiableSet<Item>['get']>>().toEqualTypeOf<[identifier: string]>()
    const first: Item = { identifier: 'one', name: 'first' }
    const set = new IdentifiableSet<Item>()
    const added = vi.fn()
    const deleted = vi.fn()
    set.onAdd.connect(added)
    set.onDelete.connect(deleted)

    expect(set.add(first)).toBe(set)
    expect(set.get('one')).toBe(first)
    expect(set.get('missing')).toBeUndefined()
    expect(set.has(first)).toBe(true)
    expect(set.size).toBe(1)
    expect(added).toHaveBeenCalledExactlyOnceWith(first)

    expect(set.delete({ identifier: 'one', name: 'another object' })).toBe(true)
    expect(set.delete(first)).toBe(false)
    expect(set.get('one')).toBeUndefined()
    expect(deleted).toHaveBeenCalledExactlyOnceWith(first)
  })

  it('rejects duplicate identifiers without modifying the collection', () => {
    const first: Item = { identifier: 'one', name: 'first' }
    const second: Item = { identifier: 'one', name: 'second' }
    const set = new IdentifiableSet([first])
    const added = vi.fn()
    set.onAdd.connect(added)

    expect(() => set.add(second)).toThrow('An object with this identifier already exists.')
    expect(() => set.add(first)).toThrow(Error)
    expect(set.get('one')).toBe(first)
    expect(set.size).toBe(1)
    expect(added).not.toHaveBeenCalled()
    expect(() => new IdentifiableSet([first, second])).toThrow(Error)
  })

  it('accepts iterables and iterates values in insertion order', () => {
    const first: Item = { identifier: 'one', name: 'first' }
    const second: Item = { identifier: 'two', name: 'second' }
    const set = new IdentifiableSet(new Set([first, second]))

    expect([...set]).toEqual([first, second])
    expect([...set.values()]).toEqual([first, second])
  })

  it('clears all values before notifying and preserves callback additions', () => {
    const first: Item = { identifier: 'one', name: 'first' }
    const second: Item = { identifier: 'two', name: 'second' }
    const next: Item = { identifier: 'three', name: 'third' }
    const set = new IdentifiableSet([first, second])
    const deleted = vi.fn((value: Item) => {
      if (value === first) {
        expect(set.size).toBe(0)
        set.add(next)
      }
    })
    set.onDelete.connect(deleted)

    set.clear()

    expect(deleted).toHaveBeenNthCalledWith(1, first)
    expect(deleted).toHaveBeenNthCalledWith(2, second)
    expect([...set]).toEqual([next])
  })

  it('supports undefined and NaN identifiers with Map equality', () => {
    const set = new IdentifiableSet<Identifiable<number | undefined>>()
    const missing = { identifier: undefined }
    const nan = { identifier: NaN }

    set.add(missing)
    set.add(nan)
    expect(set.get(undefined)).toBe(missing)
    expect(set.get(NaN)).toBe(nan)
    expect(() => set.add({ identifier: NaN })).toThrow(Error)
  })

  it('propagates listener errors after changing the collection', () => {
    const set = new IdentifiableSet<Item>()
    const item: Item = { identifier: 'one', name: 'first' }
    set.onAdd.connect(() => {
      throw new Error('listener failed')
    })

    expect(() => set.add(item)).toThrow('listener failed')
    expect(set.get('one')).toBe(item)
  })
})
