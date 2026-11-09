import { describe, expect, it } from 'vitest'

import { Color, Store } from '../../../source/index.js'

describe('Color', () => {
  it('creates opaque colors by default and preserves HDR components', () => {
    expect(new Color()).toEqual(new Color(0, 0, 0, 1))
    expect(new Color(2, -1, 0.5, 0.25)).toMatchObject({ r: 2, g: -1, b: 0.5, a: 0.25 })
    expect(Color.transparent).toEqual(new Color(0, 0, 0, 0))
  })

  it.each([
    ['#123', '#112233FF'],
    ['#1234', '#11223344'],
    ['#aBcDeF', '#ABCDEFFF'],
    ['0Xabcdef12', '#ABCDEF12'],
    ['  ff0080  ', '#FF0080FF'],
  ])('parses %s as %s', (input, expected) => {
    expect(Color.parse(input).toHex()).toBe(expected)
    expect(new Color(input).toString()).toBe(expected)
    expect(Color.fromHex(input).toString()).toBe(expected)
  })

  it.each(['', '#12', '#12345', '#1234567', '#123456789', '#12gg56', '##123', '0x#123'])(
    'rejects invalid hexadecimal input %s',
    (input) => {
      expect(Color.tryParse(input)).toBeUndefined()
      expect(() => Color.parse(input)).toThrow('not a valid hexadecimal color')
    },
  )

  it('handles nullish input in tryParse', () => {
    expect(Color.tryParse(null)).toBeUndefined()
    expect(Color.tryParse(undefined)).toBeUndefined()
  })

  it('validates byte components and converts alpha', () => {
    expect(Color.fromBytes(255, 0, 128, 64).toHex()).toBe('#FF008040')
    expect(() => Color.fromBytes(-1, 0, 0)).toThrow(RangeError)
    expect(() => Color.fromBytes(0, 256, 0)).toThrow(RangeError)
    expect(() => Color.fromBytes(0, 0, 1.5)).toThrow(RangeError)
    expect(() => Color.fromBytes(0, 0, 0, NaN)).toThrow(RangeError)
  })

  it('round-trips every byte value through hexadecimal', () => {
    for (let value = 0; value <= 255; value++) {
      const color = Color.fromBytes(value, value, value, value)
      expect(Color.parse(color.toHex())).toEqual(color)
    }
  })

  it('clamps, rounds ties to even, and optionally omits alpha', () => {
    const color = new Color(-1, 2, 0.5, 0.5)
    expect(color.clamped()).toEqual(new Color(0, 1, 0.5, 0.5))
    expect(color.toHex()).toBe('#00FF8080')
    expect(color.toHex(false)).toBe('#00FF80')
    expect(new Color(0.5 / 255, 1.5 / 255, 2.5 / 255).toHex(false)).toBe('#000202')
    expect(Color.clamp(color, -0.5, 0.75)).toEqual(new Color(-0.5, 0.75, 0.5, 0.5))
    expect(() => Color.clamp(color, 2, 1)).toThrow(RangeError)
    expect(() => Color.clamp(color, NaN, 1)).toThrow(RangeError)
    expect(() => new Color(NaN).toHex()).toThrow(RangeError)
    expect(new Color(0, 0, 0, NaN).toHex(false)).toBe('#000000')
    expect(new Color(Infinity, -Infinity).toHex(false)).toBe('#FF0000')
  })

  it('performs arithmetic and interpolation including alpha', () => {
    const first = new Color(1, 2, 3, 4)
    const second = new Color(2, 4, 6, 8)
    expect(first.add(second)).toEqual(new Color(3, 6, 9, 12))
    expect(second.subtract(first)).toEqual(first)
    expect(first.multiply(second)).toEqual(new Color(2, 8, 18, 32))
    expect(second.divide(first)).toEqual(new Color(2, 2, 2, 2))
    expect(second.divide(2)).toEqual(first)
    expect(first.divide(0)).toEqual(new Color(Infinity, Infinity, Infinity, Infinity))
    expect(first.scale(2)).toEqual(second)
    expect(first.negate()).toEqual(new Color(-1, -2, -3, -4))
    expect(Color.lerp(first, second, 0.5)).toEqual(new Color(1.5, 3, 4.5, 6))
    expect(Color.lerp(first, second, 2)).toEqual(new Color(3, 6, 9, 12))
    expect(first.withAlpha(0.5)).toEqual(new Color(1, 2, 3, 0.5))
    expect(first).toEqual(new Color(1, 2, 3, 4))
  })

  it('provides named colors and value equality for stores', () => {
    expect(Color.black.toHex()).toBe('#000000FF')
    expect(Color.blue.toHex()).toBe('#0000FFFF')
    expect(Color.cornflowerBlue.toHex()).toBe('#6495EDFF')
    expect(Color.cyan.toHex()).toBe('#00FFFFFF')
    expect(Color.gray.toHex()).toBe('#808080FF')
    expect(Color.green.toHex()).toBe('#00FF00FF')
    expect(Color.magenta.toHex()).toBe('#FF00FFFF')
    expect(Color.red.toHex()).toBe('#FF0000FF')
    expect(Color.white.toHex()).toBe('#FFFFFFFF')
    expect(Color.yellow.toHex()).toBe('#FFFF00FF')
    expect(new Color(NaN).equals(new Color(NaN))).toBe(true)
    expect(new Color(-0).equals(new Color(0))).toBe(true)
    const store = new Store(Color.red)
    const initial = store.value
    store.value = new Color(1, 0, 0)
    expect(store.value).toBe(initial)
  })

  it('creates random normalized opaque colors', () => {
    const color = Color.random()
    expect(color.r).toBeGreaterThanOrEqual(0)
    expect(color.r).toBeLessThan(1)
    expect(color.g).toBeGreaterThanOrEqual(0)
    expect(color.g).toBeLessThan(1)
    expect(color.b).toBeGreaterThanOrEqual(0)
    expect(color.b).toBeLessThan(1)
    expect(color.a).toBe(1)
  })
})
