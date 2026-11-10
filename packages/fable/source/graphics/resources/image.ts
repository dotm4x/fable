import { Resource } from '#/core/primitives/resource.js'

/** Specifies the in-memory layout of image pixels. */
export enum RasterImageFormat {
  /** Four 8-bit channels in red, green, blue and alpha order. */
  rgba8 = 'rgba8',
  /** Four 8-bit channels in red, green, blue and alpha order, sRGB encoded. */
  rgba8Srgb = 'rgba8-srgb',
}

const bytesPerPixel: ReadonlyMap<RasterImageFormat, number> = new Map([
  [RasterImageFormat.rgba8, 4],
  [RasterImageFormat.rgba8Srgb, 4],
])

/**
 * Decoded two-dimensional pixel data.
 *
 * An image contains pixels in CPU memory, independent from the encoded file
 * format and from any texture a renderer creates from it. The image copies and
 * owns its pixel buffer, and clears it when destroyed.
 */
export class Image extends Resource {
  private _data: Uint8Array

  /** In-memory pixel format. */
  public readonly format: RasterImageFormat

  /** Image height, in pixels. */
  public readonly height: number

  /** Image width, in pixels. */
  public readonly width: number

  /**
   * @param width - The image width, in pixels.
   * @param height - The image height, in pixels.
   * @param data - The pixel data ordered from left to right and top to bottom.
   * @param format - The in-memory format of each pixel.
   * @throws {@link RangeError} If a dimension is not a positive integer or the data size overflows.
   * @throws {@link Error} If the data size does not match the dimensions and pixel format.
   */
  public constructor(
    width: number,
    height: number,
    data: Uint8Array,
    format: RasterImageFormat = RasterImageFormat.rgba8,
  ) {
    super()
    if (!Number.isInteger(width) || width <= 0) {
      throw new RangeError('Image width must be a positive integer.')
    }

    if (!Number.isInteger(height) || height <= 0) {
      throw new RangeError('Image height must be a positive integer.')
    }

    const expectedSize = Image.calculateDataSize(width, height, format)
    if (data.length !== expectedSize) {
      throw new Error(
        `Image data contains ${String(data.length)} bytes, but ${String(expectedSize)} bytes were expected.`,
      )
    }

    this.width = width
    this.height = height
    this.format = format
    this._data = new Uint8Array(data)
  }

  /**
   * The pixel data ordered from left to right and top to bottom.
   *
   * The buffer is owned by the image; consumers must not mutate it.
   */
  public get data(): Uint8Array {
    this.throwIfDestroyed()

    return this._data
  }

  /** The number of bytes occupied by the image data. */
  public get dataSize(): number {
    this.throwIfDestroyed()

    return this._data.length
  }

  /**
   * Calculates the number of bytes required by an image.
   *
   * @param width - The image width, in pixels.
   * @param height - The image height, in pixels.
   * @param format - The image pixel format.
   * @returns The required number of bytes.
   * @throws {@link RangeError} If the dimensions are not positive or the result overflows.
   */
  public static calculateDataSize(
    width: number,
    height: number,
    format: RasterImageFormat = RasterImageFormat.rgba8,
  ): number {
    const size = width * height * Image.getBytesPerPixel(format)
    if (!Number.isSafeInteger(size) || size <= 0) {
      throw new RangeError('Image dimensions are too large.')
    }

    return size
  }

  /**
   * Gets the number of bytes occupied by one pixel.
   *
   * @param format - The pixel format to inspect.
   * @returns The number of bytes occupied by one pixel.
   */
  public static getBytesPerPixel(format: RasterImageFormat = RasterImageFormat.rgba8): number {
    const bytes = bytesPerPixel.get(format)
    if (bytes === undefined) {
      throw new RangeError(`Unsupported image format '${format}'.`)
    }

    return bytes
  }

  protected override onDestroy(): void {
    this._data = new Uint8Array(0)
    super.onDestroy()
  }
}
