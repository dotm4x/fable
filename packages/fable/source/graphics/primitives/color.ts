/**
 * An immutable RGBA color. Components are typically normalized to 0–1, but
 * values outside that range are retained for operations such as HDR rendering.
 */
export class Color {
  /** Red component. */
  public readonly r: number
  /** Green component. */
  public readonly g: number
  /** Blue component. */
  public readonly b: number
  /** Alpha component. */
  public readonly a: number

  /** Creates an opaque black color by default, or a color from RGBA components. */
  public constructor(red?: number, green?: number, blue?: number, alpha?: number)
  /** Creates a color from a hexadecimal string. */
  public constructor(hexadecimal: string)
  public constructor(
    redOrHexadecimal: number | string = 0,
    green: number = 0,
    blue: number = 0,
    alpha: number = 1,
  ) {
    if (typeof redOrHexadecimal === 'string') {
      const color = Color.parse(redOrHexadecimal)
      this.r = color.r
      this.g = color.g
      this.b = color.b
      this.a = color.a
    } else {
      this.r = redOrHexadecimal
      this.g = green
      this.b = blue
      this.a = alpha
    }
  }

  /** Opaque black. */
  public static get black(): Color {
    return new Color(0, 0, 0)
  }

  /** Opaque blue. */
  public static get blue(): Color {
    return new Color(0, 0, 1)
  }

  /** Cornflower blue. */
  public static get cornflowerBlue(): Color {
    return Color.fromHex('#6495ED')
  }

  /** Opaque cyan. */
  public static get cyan(): Color {
    return new Color(0, 1, 1)
  }

  /** Opaque gray. */
  public static get gray(): Color {
    return new Color(0.5, 0.5, 0.5)
  }

  /** Opaque green. */
  public static get green(): Color {
    return new Color(0, 1, 0)
  }

  /** Opaque magenta. */
  public static get magenta(): Color {
    return new Color(1, 0, 1)
  }

  /** Opaque red. */
  public static get red(): Color {
    return new Color(1, 0, 0)
  }

  /** Transparent black. */
  public static get transparent(): Color {
    return new Color(0, 0, 0, 0)
  }

  /** Opaque white. */
  public static get white(): Color {
    return new Color(1, 1, 1)
  }

  /** Opaque yellow. */
  public static get yellow(): Color {
    return new Color(1, 1, 0)
  }

  /**
   * Creates a color from integer components in the range 0–255.
   *
   * @throws {@link RangeError} If a component is not an integer in range.
   */
  public static fromBytes(red: number, green: number, blue: number, alpha: number = 255): Color {
    for (const component of [red, green, blue, alpha]) {
      if (!Number.isInteger(component) || component < 0 || component > 255) {
        throw new RangeError('Color byte components must be integers between 0 and 255.')
      }
    }

    return new Color(red / 255, green / 255, blue / 255, alpha / 255)
  }

  /**
   * Parses RGB, RGBA, RRGGBB, or RRGGBBAA, optionally prefixed by `#` or `0x`.
   *
   * @param value - The hexadecimal color, optionally surrounded by whitespace.
   * @returns The parsed color.
   * @throws {@link Error} If the string is not a valid hexadecimal color.
   */
  public static parse(value: string): Color {
    const color = Color.tryParse(value)
    if (color === undefined) {
      throw new Error(`'${value}' is not a valid hexadecimal color.`)
    }

    return color
  }

  /** @see {@link Color.parse} */
  public static fromHex(value: string): Color {
    return Color.parse(value)
  }

  /**
   * Attempts to parse a hexadecimal color.
   *
   * @param value - The hexadecimal color.
   * @returns The parsed color, or `undefined` if the input is invalid.
   */
  public static tryParse(value: string | null | undefined): Color | undefined {
    if (value === null || value === undefined) {
      return undefined
    }

    const hex = value.trim().replace(/^(?:#|0x)/i, '')
    if (!/^(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(hex)) {
      return undefined
    }

    const expanded =
      hex.length <= 4 ? Array.from(hex, (character) => character + character).join('') : hex
    const red = Number.parseInt(expanded.slice(0, 2), 16)
    const green = Number.parseInt(expanded.slice(2, 4), 16)
    const blue = Number.parseInt(expanded.slice(4, 6), 16)
    const alpha = expanded.length === 8 ? Number.parseInt(expanded.slice(6, 8), 16) : 255
    return Color.fromBytes(red, green, blue, alpha)
  }

  /**
   * Constrains all components to the supplied range.
   *
   * @throws {@link RangeError} If the bounds are NaN or minimum exceeds maximum.
   */
  public static clamp(color: Color, minimum: number = 0, maximum: number = 1): Color {
    if (Number.isNaN(minimum) || Number.isNaN(maximum) || minimum > maximum) {
      throw new RangeError('Color clamp bounds must be ordered numbers.')
    }

    const clampComponent = (value: number): number => Math.min(maximum, Math.max(minimum, value))
    return new Color(
      clampComponent(color.r),
      clampComponent(color.g),
      clampComponent(color.b),
      clampComponent(color.a),
    )
  }

  /**
   * Linearly interpolates all components, including alpha.
   *
   * The amount is not clamped, allowing extrapolation.
   */
  public static lerp(start: Color, end: Color, amount: number): Color {
    return start.add(end.subtract(start).scale(amount))
  }

  /** Creates a random opaque color. */
  public static random(): Color {
    return new Color(Math.random(), Math.random(), Math.random())
  }

  /** Returns this color with all components clamped to 0–1. */
  public clamped(): Color {
    return Color.clamp(this)
  }

  /** Adds corresponding components. */
  public add(other: Color): Color {
    return new Color(this.r + other.r, this.g + other.g, this.b + other.b, this.a + other.a)
  }

  /** Subtracts corresponding components. */
  public subtract(other: Color): Color {
    return new Color(this.r - other.r, this.g - other.g, this.b - other.b, this.a - other.a)
  }

  /** Multiplies corresponding components. */
  public multiply(other: Color): Color {
    return new Color(this.r * other.r, this.g * other.g, this.b * other.b, this.a * other.a)
  }

  /** Divides corresponding components or all components by a scalar. */
  public divide(other: Color | number): Color {
    if (typeof other === 'number') {
      return new Color(this.r / other, this.g / other, this.b / other, this.a / other)
    }

    return new Color(this.r / other.r, this.g / other.g, this.b / other.b, this.a / other.a)
  }

  /** Multiplies all components by a scalar. */
  public scale(scalar: number): Color {
    return new Color(this.r * scalar, this.g * scalar, this.b * scalar, this.a * scalar)
  }

  /** Negates all components. */
  public negate(): Color {
    return this.scale(-1)
  }

  /** Returns a copy with the given alpha component. */
  public withAlpha(alpha: number): Color {
    return new Color(this.r, this.g, this.b, alpha)
  }

  /** Checks whether all corresponding components have the same value. */
  public equals(other: Color): boolean {
    const equal = (left: number, right: number): boolean =>
      left === right || (Number.isNaN(left) && Number.isNaN(right))
    return (
      equal(this.r, other.r) &&
      equal(this.g, other.g) &&
      equal(this.b, other.b) &&
      equal(this.a, other.a)
    )
  }

  /**
   * Returns uppercase `#RRGGBB` or `#RRGGBBAA`, clamping components to 0–1.
   *
   * @throws {@link RangeError} If a component is NaN.
   */
  public toHex(includeAlpha: boolean = true): string {
    const components = includeAlpha ? [this.r, this.g, this.b, this.a] : [this.r, this.g, this.b]
    return `#${components
      .map((component) => {
        if (Number.isNaN(component)) {
          throw new RangeError('Cannot convert a NaN color component to hexadecimal.')
        }

        const scaled = Math.min(1, Math.max(0, component)) * 255
        const lower = Math.floor(scaled)
        const rounded = scaled - lower === 0.5 && lower % 2 === 0 ? lower : Math.round(scaled)
        return rounded.toString(16).padStart(2, '0').toUpperCase()
      })
      .join('')}`
  }

  /** Returns the `#RRGGBBAA` representation. */
  public toString(): string {
    return this.toHex()
  }
}
