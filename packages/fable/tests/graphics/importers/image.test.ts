import { afterEach, describe, expect, it, vi } from 'vitest'

import { Image, ImageImporter } from '../../../source/index.js'

interface TestCanvasContext {
  readonly drawImage: () => void
  readonly getImageData: () => ImageData
}

class TestCanvas {
  public static readonly instances: TestCanvas[] = []

  public readonly context: TestCanvasContext
  public readonly height: number
  public readonly width: number

  public constructor(width: number, height: number) {
    this.width = width
    this.height = height
    this.context = {
      drawImage: vi.fn(),
      getImageData: vi.fn(
        () => ({ data: new Uint8ClampedArray([255, 0, 0, 255]) }) as unknown as ImageData,
      ),
    }
    TestCanvas.instances.push(this)
  }

  public getContext(): TestCanvasContext | null {
    return this.context
  }
}

class NoContextCanvas {
  public getContext(): null {
    return null
  }
}

describe('ImageImporter', () => {
  afterEach(() => {
    TestCanvas.instances.length = 0
    vi.unstubAllGlobals()
  })

  function createBitmap(): { bitmap: ImageBitmap; close: ReturnType<typeof vi.fn> } {
    const close = vi.fn()
    const bitmap = { width: 1, height: 1, close } as unknown as ImageBitmap

    return { bitmap, close }
  }

  it('supports image extensions and decodes bodies into pixel data', async () => {
    const controller = new AbortController()
    const fetchMock = vi.fn((source: string) => Promise.resolve(new Response(source)))
    const { bitmap, close } = createBitmap()
    const decodeMock = vi.fn(() => Promise.resolve(bitmap))
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('createImageBitmap', decodeMock)
    vi.stubGlobal('OffscreenCanvas', TestCanvas)

    const importer = new ImageImporter()
    const imported = await importer.load('image.webp', controller.signal)

    expect(importer.extensions).toEqual(['.png', '.jpg', '.jpeg', '.webp'])
    expect(imported.value).toBeInstanceOf(Image)
    expect(imported.value.width).toBe(1)
    expect(imported.value.height).toBe(1)
    expect([...imported.value.data]).toEqual([255, 0, 0, 255])
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith('image.webp', { signal: controller.signal })
    expect(decodeMock).toHaveBeenCalledExactlyOnceWith(expect.any(Blob))
    expect(close).toHaveBeenCalledOnce()

    imported.release?.()
    expect(imported.value.destroyed).toBe(true)
  })

  it('rejects unsuccessful responses without decoding', async () => {
    const decodeMock = vi.fn()
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('missing', { status: 404 }))),
    )
    vi.stubGlobal('createImageBitmap', decodeMock)

    await expect(
      new ImageImporter().load('missing.png', new AbortController().signal),
    ).rejects.toThrow('status 404')
    expect(decodeMock).not.toHaveBeenCalled()
  })

  it('rejects invalid image data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('not an image'))),
    )
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(() => Promise.reject(new Error('The source image cannot be decoded.'))),
    )

    await expect(
      new ImageImporter().load('invalid.png', new AbortController().signal),
    ).rejects.toThrow('cannot be decoded')
  })

  it('rejects requests without a two-dimensional canvas context', async () => {
    const { bitmap } = createBitmap()
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('image'))),
    )
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(() => Promise.resolve(bitmap)),
    )
    vi.stubGlobal('OffscreenCanvas', NoContextCanvas)

    await expect(
      new ImageImporter().load('image.png', new AbortController().signal),
    ).rejects.toThrow('canvas context is unavailable')
  })

  it('propagates aborted requests', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((source: string, init?: RequestInit) =>
        init?.signal?.aborted === true
          ? Promise.reject(new DOMException(`Loading '${source}' was aborted.`, 'AbortError'))
          : Promise.resolve(new Response(source)),
      ),
    )
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(() => Promise.resolve(createBitmap().bitmap)),
    )
    vi.stubGlobal('OffscreenCanvas', TestCanvas)
    const controller = new AbortController()
    controller.abort()

    await expect(new ImageImporter().load('image.png', controller.signal)).rejects.toThrow(
      'aborted',
    )
  })

  it('closes the bitmap and rejects when aborted during decoding', async () => {
    const controller = new AbortController()
    const { bitmap, close } = createBitmap()
    let resolveDecode: (value: ImageBitmap) => void = () => undefined
    const decodeMock = vi.fn(
      () =>
        new Promise<ImageBitmap>((resolve) => {
          resolveDecode = resolve
        }),
    )
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('image'))),
    )
    vi.stubGlobal('createImageBitmap', decodeMock)
    vi.stubGlobal('OffscreenCanvas', TestCanvas)

    const pending = new ImageImporter().load('image.png', controller.signal)
    await vi.waitFor(() => {
      expect(decodeMock).toHaveBeenCalledOnce()
    })
    controller.abort()
    resolveDecode(bitmap)

    await expect(pending).rejects.toThrow()
    expect(close).toHaveBeenCalledOnce()
  })
})
