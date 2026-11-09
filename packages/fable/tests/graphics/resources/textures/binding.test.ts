import { describe, expect, it } from 'vitest'

import { Image, ImageTexture, TextureBinding, TextureSampler } from '../../../../source/index.js'

describe('ImageTexture', () => {
  it('reports the image size and borrows the image', () => {
    const image = new Image(4, 2, new Uint8Array(4 * 2 * 4))
    const texture = new ImageTexture(image)

    expect(texture.image).toBe(image)
    expect(texture.size).toEqual({ x: 4, y: 2 })
    texture.destroy()
    expect(image.destroyed).toBe(false)
    image.destroy()
  })

  it('rejects destroyed images', () => {
    const image = new Image(1, 1, new Uint8Array(4))
    image.destroy()

    expect(() => new ImageTexture(image)).toThrow('source image is destroyed')
  })
})

describe('TextureBinding', () => {
  it('associates a texture with a sampler', () => {
    const image = new Image(1, 1, new Uint8Array(4))
    const texture = new ImageTexture(image)
    const sampler = new TextureSampler()
    const binding = new TextureBinding(texture, sampler)

    expect(binding.texture).toBe(texture)
    expect(binding.sampler).toBe(sampler)

    texture.destroy()
    sampler.destroy()
    image.destroy()
  })
})
