import { describe, expect, it } from 'vitest'

import { TextureAddressMode, TextureFilter, TextureSampler } from '../../../../source/index.js'

describe('TextureSampler', () => {
  it('defaults to linear filtering and clamped addressing', () => {
    const sampler = new TextureSampler()

    expect(sampler.minFilter).toBe(TextureFilter.linear)
    expect(sampler.magFilter).toBe(TextureFilter.linear)
    expect(sampler.addressU).toBe(TextureAddressMode.clampToEdge)
    expect(sampler.addressV).toBe(TextureAddressMode.clampToEdge)
    sampler.destroy()
  })

  it('exposes custom filtering and addressing', () => {
    const sampler = new TextureSampler({
      minFilter: TextureFilter.nearest,
      magFilter: TextureFilter.nearest,
      addressU: TextureAddressMode.repeat,
      addressV: TextureAddressMode.mirroredRepeat,
    })

    expect(sampler.minFilter).toBe(TextureFilter.nearest)
    expect(sampler.magFilter).toBe(TextureFilter.nearest)
    expect(sampler.addressU).toBe(TextureAddressMode.repeat)
    expect(sampler.addressV).toBe(TextureAddressMode.mirroredRepeat)
    sampler.destroy()
  })
})
