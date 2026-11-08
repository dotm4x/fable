import { describe, expect, it, vi } from 'vitest';

import { ReactiveMap } from '../../source/index.js';

describe('ReactiveMap', () => {
  it('supports ordinary map operations and emits only for changes', () => {
    const map = new ReactiveMap<string, number>([['a', 1]]);
    const onAdd = vi.fn();
    const onUpdate = vi.fn();
    const onDelete = vi.fn();
    map.onAdd.connect(onAdd);
    map.onUpdate.connect(onUpdate);
    map.onDelete.connect(onDelete);

    expect(map).toBeInstanceOf(Map);
    expect(map.set('a', 1)).toBe(map);
    expect(map.set('a', 2)).toBe(map);
    expect(map.set('b', 3)).toBe(map);
    expect(map.delete('missing')).toBe(false);
    expect(map.delete('a')).toBe(true);

    expect([...map]).toEqual([['b', 3]]);
    expect(onAdd).toHaveBeenCalledExactlyOnceWith('b', 3);
    expect(onUpdate).toHaveBeenCalledExactlyOnceWith('a', 2, 1);
    expect(onDelete).toHaveBeenCalledExactlyOnceWith('a', 2);
  });

  it('handles undefined values and Object.is comparisons', () => {
    const map = new ReactiveMap<string, number | undefined>();
    const onUpdate = vi.fn();
    const onDelete = vi.fn();
    map.onUpdate.connect(onUpdate);
    map.onDelete.connect(onDelete);

    map.set('key', undefined);
    map.set('key', NaN);
    map.set('key', NaN);
    map.delete('key');

    expect(onUpdate).toHaveBeenCalledExactlyOnceWith('key', NaN, undefined);
    expect(onDelete).toHaveBeenCalledExactlyOnceWith('key', NaN);
  });

  it('clears all entries before notifying, preserving entries added by callbacks', () => {
    const map = new ReactiveMap<string, number>([
      ['a', 1],
      ['b', 2],
    ]);
    const onDelete = vi.fn((key: string) => {
      if (key === 'a') {
        expect(map.size).toBe(0);
        map.set('c', 3);
      }
    });
    map.onDelete.connect(onDelete);

    map.clear();

    expect(onDelete).toHaveBeenNthCalledWith(1, 'a', 1);
    expect(onDelete).toHaveBeenNthCalledWith(2, 'b', 2);
    expect([...map]).toEqual([['c', 3]]);
  });

  it('accepts any iterable as its initial entries', () => {
    const map = new ReactiveMap(new Map([['a', 1]]));
    expect([...map]).toEqual([['a', 1]]);
  });

  it('stores the value before notifying and propagates callback errors', () => {
    const map = new ReactiveMap<string, number>();
    map.onAdd.connect((key, value) => {
      expect(map.get(key)).toBe(value);
      throw new Error('listener failed');
    });

    expect(() => map.set('key', 1)).toThrow('listener failed');
    expect(map.get('key')).toBe(1);
  });
});
