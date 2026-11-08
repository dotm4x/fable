import { describe, expect, it, vi } from 'vitest';

import { Store, type StoreChange } from '../../source/index.js';

describe('Store', () => {
  it('updates its value and dispatches the previous and new values', () => {
    const store = new Store(1);
    const callback = vi.fn<(change: StoreChange<number>) => void>();
    store.connect(callback);

    store.value = 2;

    expect(store.value).toBe(2);
    expect(callback).toHaveBeenCalledWith({ previous: 1, value: 2 });
  });

  it('does not dispatch when primitive values are equal', () => {
    const store = new Store(1);
    const callback = vi.fn();
    store.connect(callback);

    store.value = 1;

    expect(callback).not.toHaveBeenCalled();
  });

  it('uses the previous object equals method to compare values', () => {
    class EqualValue {
      public constructor(public readonly value: number) {}

      public equals(other: EqualValue): boolean {
        return this.value === other.value;
      }
    }

    const first = new EqualValue(1);
    const store = new Store(first);
    const callback = vi.fn();
    store.connect(callback);

    store.value = new EqualValue(1);
    expect(store.value).toBe(first);
    expect(callback).not.toHaveBeenCalled();

    const next = new EqualValue(2);
    store.value = next;

    expect(store.value).toBe(next);
    expect(callback).toHaveBeenCalledWith({ previous: first, value: next });
  });

  it('can clear connections and rejects updates after destruction', () => {
    const store = new Store(1);
    const callback = vi.fn();
    store.connect(callback);

    store.clear();
    store.value = 2;
    expect(callback).not.toHaveBeenCalled();

    store.destroy();
    expect(() => {
      store.value = 3;
    }).toThrow(Error);
  });
});
