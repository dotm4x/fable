import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  BlendMode,
  Camera2D,
  ClearCommand,
  Color,
  Draw2DCommand,
  GraphicMaterial,
  GraphicMesh2D,
  GraphicVertex2D,
  Image,
  ImageTexture,
  Matrix3x2,
  Matrix4x4,
  RasterImageFormat,
  RenderContext,
  RenderTarget,
  Shader,
  ShaderLanguage,
  ShaderStage,
  TextureBinding,
  TextureSampler,
  Vector2,
  Viewport,
  WebGlBackend,
} from '../../../../../source/index.js'
import { createGlHarness, type GlHarness } from '../../../../gpu/webgl-harness.js'

function createMaterial(
  textures?: Iterable<TextureBinding>,
  blend: BlendMode = BlendMode.alpha,
): GraphicMaterial {
  return new GraphicMaterial({
    vertexShader: new Shader({
      code: 'vertex',
      language: ShaderLanguage.glsl,
      stage: ShaderStage.vertex,
    }),
    fragmentShader: new Shader({
      code: 'fragment',
      language: ShaderLanguage.glsl,
      stage: ShaderStage.fragment,
    }),
    ...(textures === undefined ? {} : { textures }),
    blend,
  })
}

function createMesh(x: number = 0): GraphicMesh2D {
  return new GraphicMesh2D([
    new GraphicVertex2D(new Vector2(x, 0), new Vector2(0, 0), Color.red),
    new GraphicVertex2D(new Vector2(x + 1, 0), new Vector2(1, 0), Color.green),
    new GraphicVertex2D(new Vector2(x, 1), new Vector2(0, 1), Color.blue),
  ])
}

function createCommand(material: GraphicMaterial, x: number = 0): Draw2DCommand {
  return new Draw2DCommand({ mesh: createMesh(x), material, transform: Matrix3x2.identity })
}

function createContext(): RenderContext {
  return new RenderContext(0, new Camera2D(), new Viewport(new Vector2(0, 0), new Vector2(100, 50)))
}

describe('WebGlBackend', () => {
  beforeEach(() => {
    vi.stubGlobal('devicePixelRatio', 1)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function createBackend(options?: { antialias?: boolean }): {
    backend: WebGlBackend
    harness: GlHarness
  } {
    const harness = createGlHarness()
    const backend = new WebGlBackend({ canvas: harness.canvas, ...options })

    return { backend, harness }
  }

  it('reports when a WebGL 2 context is unavailable', () => {
    const canvas = { getContext: () => null } as unknown as HTMLCanvasElement

    expect(() => new WebGlBackend({ canvas })).toThrow('WebGL 2 context is unavailable')
  })

  it('requests an antialiased context by default', () => {
    const harness = createGlHarness()
    new WebGlBackend({ canvas: harness.canvas })

    expect(harness.attributes?.antialias).toBe(true)
  })

  it('clears with the requested color and draws indexed geometry', () => {
    const { backend, harness } = createBackend()
    const material = createMaterial()

    backend.beginFrame()
    backend.render([new ClearCommand(new Color(1, 0, 0, 1))])
    backend.render([createCommand(material)], createContext())
    backend.endFrame()

    expect(harness.gl.callsTo('clearColor')[0]?.args).toEqual([1, 0, 0, 1])
    expect(harness.gl.callsTo('clear')).toHaveLength(1)
    expect(harness.gl.callsTo('bufferData').length).toBeGreaterThanOrEqual(2)
    expect(harness.drawCalls).toHaveLength(1)
    expect(harness.drawCalls[0]?.args).toEqual([
      harness.gl.TRIANGLES,
      3,
      harness.gl.UNSIGNED_INT,
      0,
    ])
    backend.destroy()
  })

  it('batches consecutive commands that share a material', () => {
    const { backend, harness } = createBackend()
    const material = createMaterial()

    backend.beginFrame()
    backend.render(
      [createCommand(material, 0), createCommand(material, 2), createCommand(material, 4)],
      createContext(),
    )
    backend.endFrame()

    expect(harness.drawCalls).toHaveLength(1)
    expect(harness.drawCalls[0]?.args[1]).toBe(9)
    expect(backend.stats).toEqual({ drawCalls: 1, batches: 1 })
    expect(
      harness.gl.callsTo('bufferData').some((call) => call.args[2] === harness.gl.DYNAMIC_DRAW),
    ).toBe(true)
    backend.destroy()
  })

  it('splits batches when the material changes', () => {
    const { backend, harness } = createBackend()
    const first = createMaterial()
    const second = createMaterial()

    backend.beginFrame()
    backend.render(
      [createCommand(first), createCommand(first), createCommand(second)],
      createContext(),
    )
    backend.endFrame()

    expect(harness.drawCalls).toHaveLength(2)
    backend.destroy()
  })

  it('applies the material blend mode', () => {
    const { backend, harness } = createBackend()
    const additive = createMaterial(undefined, BlendMode.additive)

    backend.beginFrame()
    backend.render([createCommand(additive)], createContext())
    backend.endFrame()

    expect(harness.gl.callsTo('blendFuncSeparate')[0]?.args).toEqual([
      harness.gl.SRC_ALPHA,
      harness.gl.ONE,
      harness.gl.ONE,
      harness.gl.ONE,
    ])
    backend.destroy()
  })

  it('uploads sRGB images with an sRGB internal format', () => {
    const { backend, harness } = createBackend()
    const image = new Image(1, 1, new Uint8Array([255, 255, 255, 255]), RasterImageFormat.rgba8Srgb)
    const material = createMaterial([
      new TextureBinding(new ImageTexture(image), new TextureSampler()),
    ])

    backend.beginFrame()
    backend.render([createCommand(material)], createContext())
    backend.endFrame()

    const upload = harness.gl.callsTo('texImage2D').find((call) => call.args[8] !== null)
    expect(upload?.args[2]).toBe(harness.gl.SRGB8_ALPHA8)
    backend.destroy()
    image.destroy()
  })

  it('generates mipmaps when the sampler requests them', () => {
    const { backend, harness } = createBackend()
    const image = new Image(2, 2, new Uint8Array(2 * 2 * 4))
    const material = createMaterial([
      new TextureBinding(new ImageTexture(image), new TextureSampler({ mipmaps: true })),
    ])

    backend.beginFrame()
    backend.render([createCommand(material)], createContext())
    backend.endFrame()

    expect(harness.gl.callsTo('generateMipmap')).toHaveLength(1)
    expect(
      harness.gl
        .callsTo('texParameteri')
        .some((call) => call.args[2] === harness.gl.LINEAR_MIPMAP_LINEAR),
    ).toBe(true)
    backend.destroy()
    image.destroy()
  })

  it('renders into offscreen targets and restores the window framebuffer', () => {
    const { backend, harness } = createBackend()
    const target = new RenderTarget(new Vector2(64, 32))
    const material = createMaterial()

    backend.beginFrame()
    backend.render([new ClearCommand(Color.black)], undefined, target)
    backend.render([createCommand(material)], createContext(), target)
    backend.endFrame()

    const framebufferCalls = harness.gl.callsTo('bindFramebuffer')
    expect(
      framebufferCalls.some(
        (call) => call.args[0] === harness.gl.FRAMEBUFFER && call.args[1] === null,
      ),
    ).toBe(true)
    expect(
      harness.gl.callsTo('viewport').some((call) => call.args[2] === 64 && call.args[3] === 32),
    ).toBe(true)
    backend.destroy()
    target.destroy()
  })

  it('invalidates cached programs when a material is destroyed', () => {
    const { backend, harness } = createBackend()
    const material = createMaterial()

    backend.beginFrame()
    backend.render([createCommand(material)], createContext())
    backend.endFrame()
    expect(harness.gl.callsTo('createProgram')).toHaveLength(1)

    material.destroy()
    expect(harness.gl.callsTo('deleteProgram').length).toBeGreaterThanOrEqual(1)

    backend.beginFrame()
    expect(() => {
      backend.render([createCommand(material)], createContext())
    }).toThrow('material is destroyed')
    backend.endFrame()
    backend.destroy()
  })

  it('reports a lost context and recovers when restored', () => {
    const { backend, harness } = createBackend()
    const lost = harness.listeners.get('webglcontextlost')
    const restored = harness.listeners.get('webglcontextrestored')

    lost?.({ preventDefault: () => undefined } as unknown as Event)
    expect(() => {
      backend.beginFrame()
    }).toThrow('context was lost')

    restored?.({} as Event)
    expect(() => {
      backend.beginFrame()
      backend.endFrame()
    }).not.toThrow()
    backend.destroy()
  })

  it('uploads custom material uniforms', () => {
    const { backend, harness } = createBackend()
    const material = createMaterial()
    material.setUniform('uTint', new Color(0.1, 0.2, 0.3, 0.4))
    material.setUniform('uScale', new Vector2(2, 3))
    material.setUniform('uTime', 0.5)
    material.setUniform('uFrame', Matrix4x4.identity)

    backend.beginFrame()
    backend.render([createCommand(material)], createContext())
    backend.endFrame()

    const names = (call: string): unknown[] =>
      harness.gl.callsTo(call).map((item) => (item.args[0] as { name: string }).name)
    expect(names('uniform4f')).toContain('uTint')
    expect(names('uniform2f')).toContain('uScale')
    expect(names('uniform1f')).toContain('uTime')
    expect(names('uniformMatrix4fv')).toContain('uFrame')
    backend.destroy()
  })

  it('multisamples render targets and resolves them before sampling', () => {
    const { backend, harness } = createBackend()
    const target = new RenderTarget(new Vector2(64, 32))
    const sampler = new TextureSampler()
    const material = createMaterial([new TextureBinding(target, sampler)])

    backend.beginFrame()
    backend.render([createCommand(material)], createContext(), target)
    backend.render([createCommand(material)], createContext())
    backend.endFrame()

    expect(harness.gl.callsTo('renderbufferStorageMultisample')).toHaveLength(1)
    expect(harness.gl.callsTo('blitFramebuffer')).toHaveLength(1)
    backend.destroy()
    sampler.destroy()
    target.destroy()
  })

  it('skips multisampling when the target requests one sample', () => {
    const { backend, harness } = createBackend()
    const target = new RenderTarget(new Vector2(64, 32), { sampleCount: 1 })

    backend.beginFrame()
    backend.render([new ClearCommand(Color.black)], undefined, target)
    backend.endFrame()

    expect(harness.gl.callsTo('renderbufferStorageMultisample')).toHaveLength(0)
    expect(harness.gl.callsTo('blitFramebuffer')).toHaveLength(0)
    backend.destroy()
    target.destroy()
  })
})
