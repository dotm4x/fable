import { afterEach, describe, expect, it, vi } from 'vitest'

import { JsonImporter } from '../../../../source/index.js'

describe('JsonImporter', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('supports json sources and parses bodies with fetch', async () => {
    const controller = new AbortController()
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ name: 'fable', version: 1 }))),
    )
    vi.stubGlobal('fetch', fetchMock)

    const importer = new JsonImporter()
    const imported = await importer.load('data.json', controller.signal)

    expect(importer.extensions).toEqual(['.json'])
    expect(imported.value).toEqual({ name: 'fable', version: 1 })
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith('data.json', { signal: controller.signal })
  })

  it('rejects unsuccessful responses and invalid documents', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('missing', { status: 500 }))),
    )
    await expect(
      new JsonImporter().load('missing.json', new AbortController().signal),
    ).rejects.toThrow('status 500')

    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('not json'))),
    )
    await expect(
      new JsonImporter().load('invalid.json', new AbortController().signal),
    ).rejects.toThrow(SyntaxError)
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

    await expect(new JsonImporter().load('data.json', controller.signal)).rejects.toThrow('aborted')
  })
})
