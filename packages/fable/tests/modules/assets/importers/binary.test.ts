import { afterEach, describe, expect, it, vi } from 'vitest'

import { BinaryImporter } from '../../../../source/index.js'

describe('BinaryImporter', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('supports binary extensions and loads array buffers with fetch', async () => {
    const controller = new AbortController()
    const fetchMock = vi.fn((source: string) => Promise.resolve(new Response(source)))
    vi.stubGlobal('fetch', fetchMock)

    const importer = new BinaryImporter()
    const imported = await importer.load('data.bin', controller.signal)

    expect(importer.extensions).toEqual(['.bin', '.dat'])
    expect(imported.value).toBeInstanceOf(ArrayBuffer)
    expect(new TextDecoder().decode(imported.value)).toBe('data.bin')
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith('data.bin', { signal: controller.signal })
  })

  it('rejects unsuccessful responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('missing', { status: 503 }))),
    )

    await expect(
      new BinaryImporter().load('missing.dat', new AbortController().signal),
    ).rejects.toThrow('status 503')
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
    const controller = new AbortController()
    controller.abort()

    await expect(new BinaryImporter().load('data.bin', controller.signal)).rejects.toThrow(
      'aborted',
    )
  })
})
