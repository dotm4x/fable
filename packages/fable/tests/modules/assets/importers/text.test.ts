import { afterEach, describe, expect, it, vi } from 'vitest'

import { TextImporter } from '../../../../source/index.js'

describe('TextImporter', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('supports text extensions and loads bodies with fetch', async () => {
    const controller = new AbortController()
    const fetchMock = vi.fn((source: string) => Promise.resolve(new Response(`${source}:hello`)))
    vi.stubGlobal('fetch', fetchMock)

    const importer = new TextImporter()
    const imported = await importer.load('data.text', controller.signal)

    expect(importer.extensions).toEqual(['.txt', '.text'])
    expect(imported.value).toBe('data.text:hello')
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith('data.text', { signal: controller.signal })
  })

  it('rejects unsuccessful responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('missing', { status: 404 }))),
    )

    await expect(
      new TextImporter().load('missing.txt', new AbortController().signal),
    ).rejects.toThrow('status 404')
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

    await expect(new TextImporter().load('data.txt', controller.signal)).rejects.toThrow('aborted')
  })
})
