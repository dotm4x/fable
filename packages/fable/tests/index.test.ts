import { describe, expect, it } from 'vitest';
import * as fable from '../source/index.js';

describe('@dotm4x/fable', () => {
  it('exposes an importable package entry point', () => {
    expect(fable).toBeDefined();
  });
});
