import { afterEach, describe, expect, it, vi } from 'vitest'

import { ShaderImporter, ShaderLanguage } from '../../../source/index.js'

describe('ShaderImporter', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('supports WGSL and GLSL extensions', () => {
    const importer = new ShaderImporter()

    expect(importer.identifier).toBe('shader')
    expect(importer.extensions).toEqual(['.wgsl', '.glsl', '.vert', '.frag'])
  })

  it('loads WGSL sources', async () => {
    const controller = new AbortController()
    const fetchMock = vi.fn(() => Promise.resolve(new Response('@vertex fn main() {}')))
    vi.stubGlobal('fetch', fetchMock)

    const imported = await new ShaderImporter().load('/shaders/draw.wgsl', controller.signal)

    expect(imported.value.language).toBe(ShaderLanguage.wgsl)
    expect(imported.value.code).toBe('@vertex fn main() {}')
    expect(imported.value.path).toBe('/shaders/draw.wgsl')
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith('/shaders/draw.wgsl', {
      signal: controller.signal,
    })

    imported.release?.()
    expect(imported.value.destroyed).toBe(true)
  })

  it('derives GLSL stages from the vertex and fragment extensions', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('void main() {}'))),
    )

    const vertex = await new ShaderImporter().load(
      '/shaders/draw.vert',
      new AbortController().signal,
    )
    const fragment = await new ShaderImporter().load(
      '/shaders/draw.frag?version=1',
      new AbortController().signal,
    )

    expect(vertex.value.language).toBe(ShaderLanguage.glsl)
    expect(fragment.value.language).toBe(ShaderLanguage.glsl)
    vertex.release?.()
    fragment.release?.()
  })

  it('rejects unsuccessful responses and unsupported sources', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('missing', { status: 404 }))),
    )
    await expect(
      new ShaderImporter().load('/shaders/missing.wgsl', new AbortController().signal),
    ).rejects.toThrow('status 404')

    await expect(
      new ShaderImporter().load('/shaders/readme.txt', new AbortController().signal),
    ).rejects.toThrow('Unsupported shader source')
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

    await expect(
      new ShaderImporter().load('/shaders/draw.wgsl', controller.signal),
    ).rejects.toThrow('aborted')
  })
})
