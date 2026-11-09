import { afterEach, describe, expect, it, vi } from 'vitest'

import { ImageImporter } from '../../../../source/index.js'

function createImage(): { image: ImageBitmap; close: ReturnType<typeof vi.fn> } {
  const close = vi.fn()
  const image = { width: 4, height: 2, close } as unknown as ImageBitmap

  return { image, close }
}

describe('ImageImporter', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('supports image extensions and decodes bodies with createImageBitmap', async () => {
    const controller = new AbortController()
    const fetchMock = vi.fn((source: string) => Promise.resolve(new Response(source)))
    const { image, close } = createImage()
    const decodeMock = vi.fn(() => Promise.resolve(image))
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('createImageBitmap', decodeMock)

    const importer = new ImageImporter()
    const imported = await importer.load('image.webp', controller.signal)

    expect(importer.extensions).toEqual(['.png', '.jpg', '.jpeg', '.webp'])
    expect(imported.value).toBe(image)
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith('image.webp', { signal: controller.signal })
    expect(decodeMock).toHaveBeenCalledExactlyOnceWith(expect.any(Blob))

    imported.release?.()
    expect(close).toHaveBeenCalledOnce()
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
      vi.fn(() => Promise.resolve(createImage().image)),
    )
    const controller = new AbortController()
    controller.abort()

    await expect(new ImageImporter().load('image.png', controller.signal)).rejects.toThrow(
      'aborted',
    )
  })

  it('closes the bitmap when the request is aborted during decoding', async () => {
    const controller = new AbortController()
    const { image, close } = createImage()
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

    const pending = new ImageImporter().load('image.png', controller.signal)
    await vi.waitFor(() => {
      expect(decodeMock).toHaveBeenCalledOnce()
    })
    controller.abort()
    resolveDecode(image)

    await expect(pending).rejects.toThrow()
    expect(close).toHaveBeenCalledOnce()
  })
})
