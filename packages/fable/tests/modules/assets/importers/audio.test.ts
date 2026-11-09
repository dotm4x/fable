import { afterEach, describe, expect, it, vi } from 'vitest'

import { AudioImporter } from '../../../../source/index.js'

function createBuffer(): AudioBuffer {
  return { duration: 1, length: 1 } as unknown as AudioBuffer
}

const defaultDecode = (): Promise<AudioBuffer> => Promise.resolve(createBuffer())

class TestAudioContext {
  public static readonly instances: TestAudioContext[] = []
  public static decode: (data: ArrayBuffer) => Promise<AudioBuffer> = defaultDecode

  public readonly decoded: ArrayBuffer[] = []
  public readonly close: () => Promise<void> = vi.fn(() => Promise.resolve())

  public constructor() {
    TestAudioContext.instances.push(this)
  }

  public decodeAudioData(data: ArrayBuffer): Promise<AudioBuffer> {
    this.decoded.push(data)

    return TestAudioContext.decode(data)
  }
}

describe('AudioImporter', () => {
  afterEach(() => {
    TestAudioContext.instances.length = 0
    TestAudioContext.decode = defaultDecode
    vi.unstubAllGlobals()
  })

  function stubBrowser(fetchMock: ReturnType<typeof vi.fn>): void {
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('AudioContext', TestAudioContext)
  }

  it('supports audio extensions and decodes array buffers', async () => {
    const controller = new AbortController()
    const fetchMock = vi.fn((source: string) => Promise.resolve(new Response(source)))
    stubBrowser(fetchMock)
    const buffer = createBuffer()
    TestAudioContext.decode = () => Promise.resolve(buffer)
    const importer = new AudioImporter()

    const imported = await importer.load('sound.ogg', controller.signal)
    const context = TestAudioContext.instances[0]

    expect(importer.extensions).toEqual(['.mp3', '.wav', '.ogg'])
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith('sound.ogg', { signal: controller.signal })
    expect(context?.decoded).toHaveLength(1)
    expect(context?.decoded[0]).toBeInstanceOf(ArrayBuffer)
    expect(imported.value).toBe(buffer)
  })

  it('rejects unsuccessful responses without creating a context', async () => {
    stubBrowser(vi.fn(() => Promise.resolve(new Response('missing', { status: 404 }))))

    await expect(
      new AudioImporter().load('missing.mp3', new AbortController().signal),
    ).rejects.toThrow('status 404')
    expect(TestAudioContext.instances).toHaveLength(0)
  })

  it('rejects invalid audio data', async () => {
    stubBrowser(vi.fn(() => Promise.resolve(new Response('not audio'))))
    TestAudioContext.decode = () => Promise.reject(new Error('Unable to decode audio data.'))

    await expect(
      new AudioImporter().load('invalid.mp3', new AbortController().signal),
    ).rejects.toThrow('Unable to decode')
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
    vi.stubGlobal('AudioContext', TestAudioContext)
    const controller = new AbortController()
    controller.abort()

    await expect(new AudioImporter().load('sound.wav', controller.signal)).rejects.toThrow(
      'aborted',
    )
    expect(TestAudioContext.instances).toHaveLength(0)
  })

  it('reuses one context per importer and closes it on destruction', async () => {
    stubBrowser(vi.fn((source: string) => Promise.resolve(new Response(source))))
    const importer = new AudioImporter()

    await importer.load('first.mp3', new AbortController().signal)
    await importer.load('second.wav', new AbortController().signal)

    expect(TestAudioContext.instances).toHaveLength(1)
    const context = TestAudioContext.instances[0]

    importer.destroy()

    expect(context?.close).toHaveBeenCalledOnce()
    expect(TestAudioContext.instances).toHaveLength(1)
  })

  it('does not create a context when destroyed before the first import', () => {
    new AudioImporter().destroy()

    expect(TestAudioContext.instances).toHaveLength(0)
  })

  it('cannot cancel decoding and rejects once decoding completes', async () => {
    stubBrowser(vi.fn(() => Promise.resolve(new Response('audio'))))
    const importer = new AudioImporter()
    const controller = new AbortController()
    let resolveDecode: (value: AudioBuffer) => void = () => undefined
    const decodeMock = vi.fn(
      () =>
        new Promise<AudioBuffer>((resolve) => {
          resolveDecode = resolve
        }),
    )
    TestAudioContext.decode = decodeMock

    const pending = importer.load('sound.mp3', controller.signal)
    await vi.waitFor(() => {
      expect(decodeMock).toHaveBeenCalledOnce()
    })
    controller.abort()
    resolveDecode(createBuffer())

    await expect(pending).rejects.toThrow()
    expect(TestAudioContext.instances[0]?.close).not.toHaveBeenCalled()

    importer.destroy()
  })
})
