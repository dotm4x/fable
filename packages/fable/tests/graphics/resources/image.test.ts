import { describe, expect, it } from 'vitest'

import { Image, RasterImageFormat } from '../../../source/index.js'

describe('Image', () => {
  it('exposes dimensions, format and a copy of the pixel data', () => {
    const data = new Uint8Array([1, 2, 3, 4])
    const image = new Image(1, 1, data)

    data[0] = 99

    expect(image.width).toBe(1)
    expect(image.height).toBe(1)
    expect(image.format).toBe(RasterImageFormat.rgba8)
    expect([...image.data]).toEqual([1, 2, 3, 4])
    expect(image.dataSize).toBe(4)
  })

  it('calculates data sizes and bytes per pixel', () => {
    expect(Image.getBytesPerPixel()).toBe(4)
    expect(Image.calculateDataSize(2, 3)).toBe(24)
    expect(Image.calculateDataSize(1, 1, RasterImageFormat.rgba8)).toBe(4)
  })

  it('rejects invalid dimensions and mismatched data', () => {
    expect(() => new Image(0, 1, new Uint8Array(0))).toThrow('width must be a positive integer')
    expect(() => new Image(1, 0, new Uint8Array(0))).toThrow('height must be a positive integer')
    expect(() => new Image(1.5, 1, new Uint8Array(6))).toThrow('width must be a positive integer')
    expect(() => new Image(1, 1, new Uint8Array(3))).toThrow(
      'Image data contains 3 bytes, but 4 bytes were expected.',
    )
  })

  it('clears its data when destroyed', () => {
    const image = new Image(1, 1, new Uint8Array(4))

    image.destroy()

    expect(image.destroyed).toBe(true)
    expect(() => image.data).toThrow('destroyed')
    expect(() => image.dataSize).toThrow('destroyed')
  })
})
