import { describe, expect, it } from 'vitest';

import { type Vector, Vector2 } from '../../../../source/index.js';

describe('Vector2', () => {
  it('performs arithmetic without mutating its operands', () => {
    const vector = new Vector2(3, 4);
    const other = new Vector2(1, 2);
    const agnosticVector: Vector<Vector2> = vector;

    expect(agnosticVector.add(other)).toEqual(new Vector2(4, 6));
    expect(vector.subtract(other)).toEqual(new Vector2(2, 2));
    expect(vector.multiply(new Vector2(2, 3))).toEqual(new Vector2(6, 12));
    expect(vector.divide(new Vector2(3, 2))).toEqual(new Vector2(1, 2));
    expect(vector.scale(2)).toEqual(new Vector2(6, 8));
    expect(vector.toArray()).toEqual([3, 4]);
    expect(vector).toEqual(new Vector2(3, 4));
    expect(other).toEqual(new Vector2(1, 2));
  });

  it('calculates magnitudes, dot products, distances, and normalization', () => {
    const vector = new Vector2(3, 4);

    expect(vector.dimension).toBe(2);
    expect(vector.magnitude).toBe(5);
    expect(vector.squaredMagnitude).toBe(25);
    expect(vector.dot(new Vector2(1, 2))).toBe(11);
    expect(vector.distanceTo(new Vector2(0, 0))).toBe(5);
    const normalized = vector.normalize();
    expect(normalized.x).toBeCloseTo(0.6);
    expect(normalized.y).toBeCloseTo(0.8);
  });

  it('compares with a tolerance and rejects invalid tolerances', () => {
    const vector = new Vector2(1, 2);

    expect(vector.equals(new Vector2(1 + 1e-11, 2))).toBe(true);
    expect(vector.equals(new Vector2(1.1, 2))).toBe(false);
    expect(() => vector.equals(new Vector2(1, 2), -1)).toThrow(RangeError);
    expect(() => vector.equals(new Vector2(1, 2), Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});
