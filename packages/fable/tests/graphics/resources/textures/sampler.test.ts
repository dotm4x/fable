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

  it('defaults to isotropic sampling and accepts an anisotropy level', () => {
    const sampler = new TextureSampler()
    const anisotropic = new TextureSampler({ anisotropy: 8 })

    expect(sampler.anisotropy).toBe(1)
    expect(anisotropic.anisotropy).toBe(8)
    sampler.destroy()
    anisotropic.destroy()
  })

  it('rejects anisotropy levels that are not positive integers', () => {
    expect(() => new TextureSampler({ anisotropy: 0 })).toThrow('positive integer')
    expect(() => new TextureSampler({ anisotropy: 1.5 })).toThrow('positive integer')
  })
})
