import { type EventConnection } from '#/core/events/event.js'
import { type Resource } from '#/core/primitives/resource.js'
import { ClearCommand } from '#/graphics/commands/clear.js'
import { type DrawCommand } from '#/graphics/commands/command.js'
import { Draw2DCommand } from '#/graphics/commands/draw2d.js'
import { type GraphicMesh2D } from '#/graphics/geometry/mesh2d.js'
import { type DrawContext } from '#/graphics/interfaces/context.js'
import { type Color } from '#/graphics/primitives/color.js'
import { Viewport } from '#/graphics/primitives/viewport.js'
import { BlendMode } from '#/graphics/resources/blend-mode.js'
import { RasterImageFormat } from '#/graphics/resources/image.js'
import { type GraphicMaterial } from '#/graphics/resources/material.js'
import { ShaderLanguage } from '#/graphics/resources/shader.js'
import { RenderTarget } from '#/graphics/resources/targets/target.js'
import { TextureAddressMode } from '#/graphics/resources/textures/address-mode.js'
import { type TextureBinding } from '#/graphics/resources/textures/binding.js'
import { TextureFilter } from '#/graphics/resources/textures/filter.js'
import { ImageTexture } from '#/graphics/resources/textures/image.js'
import type { TextureSampler } from '#/graphics/resources/textures/sampler.js'
import { Matrix4x4 } from '#/math/primitives/matrices/matrix4x4.js'
import { Vector2 } from '#/math/primitives/vectors/vector2.js'

import { RenderBackend } from '../backend.js'

import { createDraw2DMaterial } from './shaders/draw2d.js'
import { createShaderModule } from './shader.js'

const floatsPerVertex = 8
const bytesPerVertex = floatsPerVertex * 4
const uniformAlignment = 256
const uniformFloats = 64
const initialUniformSlots = 64
const maxTextures = 4
const bytesPerPixel = 4
// WebGPU flag values are not exposed as globals by the TypeScript DOM library.
const bufferUsageCopyDst: GPUBufferUsageFlags = 0x0008
const bufferUsageIndex: GPUBufferUsageFlags = 0x0010
const bufferUsageVertex: GPUBufferUsageFlags = 0x0020
const bufferUsageUniform: GPUBufferUsageFlags = 0x0040
const textureUsageCopyDst: GPUTextureUsageFlags = 0x02
const textureUsageTextureBinding: GPUTextureUsageFlags = 0x04
const textureUsageRenderAttachment: GPUTextureUsageFlags = 0x10
const shaderStageVertex: GPUShaderStageFlags = 0x1
const shaderStageFragment: GPUShaderStageFlags = 0x2

interface GpuMesh {
  readonly vertexBuffer: GPUBuffer
  readonly indexBuffer: GPUBuffer
  readonly indexCount: number
}

interface GpuTexture {
  readonly texture: GPUTexture
  readonly view: GPUTextureView
}

interface PendingDraw {
  readonly command: Draw2DCommand
  readonly context: DrawContext
  readonly uniformIndex: number
  readonly flipY: boolean
}

interface RenderBatch {
  readonly target: RenderTarget | undefined
  readonly clear: Color | undefined
  readonly draws: PendingDraw[]
}

/** Configuration for a WebGPU backend. */
export interface WebGpuBackendOptions {
  /** Canvas borrowed as the drawing surface. */
  readonly canvas: HTMLCanvasElement
  /** Backend identifier. Defaults to `webgpu`. */
  readonly identifier?: string
  /** Multisample count, either 1 or 4. Defaults to 1. */
  readonly sampleCount?: number
}

/**
 * Draws two-dimensional geometry with WebGPU.
 *
 * This backend is pending validation on hardware with a WebGPU adapter; the
 * WebGL backend is the supported backend for now.
 *
 * Pipelines are created per material, meshes and textures are uploaded once and
 * offscreen targets are rendered through cached textures. Commands are encoded
 * at the end of each frame as one pass per {@link render} call, so a clear
 * command clears its destination before the first draw of that pass.
 */
export class WebGpuBackend extends RenderBackend {
  private readonly _canvas: HTMLCanvasElement
  private readonly _device: GPUDevice
  private readonly _context: GPUCanvasContext
  private readonly _format: GPUTextureFormat
  private readonly _pipelineLayout: GPUPipelineLayout
  private readonly _uniformLayout: GPUBindGroupLayout
  private readonly _textureLayout: GPUBindGroupLayout
  private readonly _sampler: GPUSampler
  private readonly _whiteImage: GpuTexture
  private readonly _whiteBindGroup: GPUBindGroup
  private readonly _meshes: Map<GraphicMesh2D, GpuMesh> = new Map<GraphicMesh2D, GpuMesh>()
  private readonly _pipelines: Map<GraphicMaterial, GPURenderPipeline> = new Map<
    GraphicMaterial,
    GPURenderPipeline
  >()
  private readonly _bindGroups: Map<GraphicMaterial, GPUBindGroup> = new Map<
    GraphicMaterial,
    GPUBindGroup
  >()
  private readonly _images: Map<TextureBinding, GpuTexture> = new Map<TextureBinding, GpuTexture>()
  private readonly _targets: Map<RenderTarget, GpuTexture> = new Map<RenderTarget, GpuTexture>()
  private readonly _tracked: Map<Resource, EventConnection> = new Map<Resource, EventConnection>()
  private readonly _samplers: Map<TextureSampler, GPUSampler> = new Map<
    TextureSampler,
    GPUSampler
  >()
  private _uniformBuffer: GPUBuffer
  private _uniformData: Float32Array
  private _uniformSlots: number
  private _batches: RenderBatch[] = []
  private _draws: PendingDraw[] = []
  private _encoder: GPUCommandEncoder | undefined
  private _canvasView: GPUTextureView | undefined
  private _lost: boolean = false
  private readonly _sampleCount: number
  private _msaaTexture: GPUTexture | undefined
  private _msaaView: GPUTextureView | undefined
  private _msaaWidth: number = 0
  private _msaaHeight: number = 0

  /** @inheritDoc */
  public readonly defaultMaterial: GraphicMaterial

  /**
   * Creates a backend from the WebGPU adapter available in the environment.
   *
   * @param options - Canvas to borrow and the optional identifier.
   * @returns The configured backend.
   * @throws {@link Error} If WebGPU, an adapter or a canvas context is unavailable.
   */
  public static async create({
    canvas,
    identifier = 'webgpu',
    sampleCount = 1,
  }: WebGpuBackendOptions): Promise<WebGpuBackend> {
    if (sampleCount !== 1 && sampleCount !== 4) {
      throw new RangeError('The WebGPU sample count must be 1 or 4.')
    }
    const gpu = gpuApi()
    if (gpu === undefined) {
      throw new Error('WebGPU is not available in this environment.')
    }
    const adapter = await gpu.requestAdapter()
    if (adapter === null) {
      throw new Error('A WebGPU adapter is not available.')
    }
    const device = await adapter.requestDevice()

    return new WebGpuBackend(
      canvas,
      identifier,
      device,
      gpu.getPreferredCanvasFormat(),
      sampleCount,
    )
  }

  private constructor(
    canvas: HTMLCanvasElement,
    identifier: string,
    device: GPUDevice,
    format: GPUTextureFormat,
    sampleCount: number,
  ) {
    super(identifier)
    // The DOM library does not declare the WebGPU context overload.
    const context = canvas.getContext('webgpu') as GPUCanvasContext | null
    if (context === null) {
      throw new Error('A WebGPU canvas context is unavailable.')
    }

    this._canvas = canvas
    this._device = device
    this._context = context
    this._format = format
    this._sampleCount = sampleCount
    this.defaultMaterial = this.createMaterial()
    context.configure({ device, format, alphaMode: 'premultiplied' })
    device.lost
      .then(() => {
        this._lost = true
      })
      .catch(() => undefined)

    this._uniformLayout = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: shaderStageVertex,
          buffer: { type: 'uniform', minBindingSize: 128 },
        },
      ],
    })
    this._textureLayout = device.createBindGroupLayout({
      entries: [
        ...[0, 1, 2, 3].map((binding) => ({
          binding,
          visibility: shaderStageFragment,
          texture: { sampleType: 'float' as const },
        })),
        ...[0, 1, 2, 3].map((index) => ({
          binding: maxTextures + index,
          visibility: shaderStageFragment,
          sampler: { type: 'filtering' as const },
        })),
      ],
    })
    this._pipelineLayout = device.createPipelineLayout({
      bindGroupLayouts: [this._uniformLayout, this._textureLayout],
    })

    this._sampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear' })
    const white = device.createTexture({
      size: [1, 1],
      format: 'rgba8unorm',
      usage: textureUsageTextureBinding | textureUsageCopyDst,
    })
    device.queue.writeTexture(
      { texture: white },
      new Uint8Array([255, 255, 255, 255]),
      { bytesPerRow: bytesPerPixel },
      { width: 1, height: 1 },
    )
    this._whiteImage = { texture: white, view: white.createView() }
    this._whiteBindGroup = this.createMaterialBindGroup([this._whiteImage.view])

    this._uniformSlots = initialUniformSlots
    this._uniformData = new Float32Array(this._uniformSlots * uniformFloats)
    this._uniformBuffer = this.createUniformBuffer()
  }

  /** @inheritDoc */
  public createMaterial(textures?: Iterable<TextureBinding>): GraphicMaterial {
    return createDraw2DMaterial(textures)
  }

  /** @inheritDoc */
  public get viewport(): Viewport {
    return new Viewport(new Vector2(0, 0), new Vector2(this._canvas.width, this._canvas.height))
  }

  protected override onBeginFrame(): void {
    if (this._lost) {
      throw new Error('The WebGPU device was lost.')
    }
    this.syncCanvasSize()
    this._batches = []
    this._draws = []
    this._encoder = this._device.createCommandEncoder()
    this._canvasView = this._context.getCurrentTexture().createView()
  }

  protected override onRender(
    commands: readonly DrawCommand[],
    context: DrawContext | undefined,
    target: RenderTarget | undefined,
  ): void {
    let clear: Color | undefined
    const draws: PendingDraw[] = []

    for (const command of commands) {
      if (command instanceof ClearCommand) {
        clear = command.color
      } else if (command instanceof Draw2DCommand) {
        if (context === undefined) throw new Error('Drawing commands require a drawing context.')
        const draw: PendingDraw = {
          command,
          context,
          uniformIndex: this._draws.length,
          flipY: target !== undefined,
        }
        this._draws.push(draw)
        draws.push(draw)
      }
    }

    this._batches.push({ target, clear, draws })
  }

  protected override onEndFrame(): void {
    const encoder = this._encoder
    const canvasView = this._canvasView
    this._encoder = undefined
    this._canvasView = undefined
    if (encoder === undefined || canvasView === undefined) return

    this.prepareUniforms()
    for (const batch of this._batches) {
      const destination =
        batch.target === undefined ? canvasView : this.targetTexture(batch.target).view
      const size =
        batch.target === undefined
          ? new Vector2(this._canvas.width, this._canvas.height)
          : batch.target.size
      const attachment: GPURenderPassColorAttachment =
        this._sampleCount > 1
          ? {
              view: this.msaaView(size.x, size.y),
              resolveTarget: destination,
              loadOp: batch.clear === undefined ? 'load' : 'clear',
              ...(batch.clear === undefined ? {} : { clearValue: toGpuColor(batch.clear) }),
              storeOp: 'discard',
            }
          : {
              view: destination,
              loadOp: batch.clear === undefined ? 'load' : 'clear',
              ...(batch.clear === undefined ? {} : { clearValue: toGpuColor(batch.clear) }),
              storeOp: 'store',
            }
      const pass = encoder.beginRenderPass({ colorAttachments: [attachment] })
      try {
        for (const draw of batch.draws) this.encodeDraw(pass, draw)
      } finally {
        pass.end()
      }
    }

    this._batches = []
    this._draws = []
    this._device.queue.submit([encoder.finish()])
  }

  protected override onDestroy(): void {
    this._uniformBuffer.destroy()
    this._whiteImage.texture.destroy()
    for (const mesh of this._meshes.values()) {
      mesh.vertexBuffer.destroy()
      mesh.indexBuffer.destroy()
    }
    this._meshes.clear()
    for (const image of this._images.values()) image.texture.destroy()
    this._images.clear()
    for (const target of this._targets.values()) target.texture.destroy()
    this._targets.clear()
    this._bindGroups.clear()
    this._pipelines.clear()
    this._samplers.clear()
    for (const connection of this._tracked.values()) connection.destroy()
    this._tracked.clear()
    this._msaaTexture?.destroy()
    this._msaaTexture = undefined
    this._msaaView = undefined
    if (!this.defaultMaterial.destroyed) this.defaultMaterial.destroy()
    this._device.destroy()
  }

  private encodeDraw(pass: GPURenderPassEncoder, draw: PendingDraw): void {
    const material = draw.command.material
    const mesh = this.gpuMesh(draw.command.mesh)
    pass.setPipeline(this.pipeline(material))
    pass.setBindGroup(0, this.createUniformBindGroup(draw.uniformIndex))
    pass.setBindGroup(1, this.materialBindGroup(material))
    pass.setVertexBuffer(0, mesh.vertexBuffer)
    pass.setIndexBuffer(mesh.indexBuffer, 'uint32')
    pass.drawIndexed(mesh.indexCount)
  }

  private prepareUniforms(): void {
    if (this._draws.length > this._uniformSlots) {
      this._uniformSlots = Math.max(this._draws.length, this._uniformSlots * 2)
      this._uniformData = new Float32Array(this._uniformSlots * uniformFloats)
      this._uniformBuffer.destroy()
      this._uniformBuffer = this.createUniformBuffer()
    }

    this._draws.forEach(({ command, context, uniformIndex, flipY }) => {
      let viewProjection = context.camera
        .getProjection(context.viewport)
        .multiply(context.camera.view)
      if (flipY) viewProjection = viewProjection.multiply(Matrix4x4.scaling(1, -1, 1))
      let cursor = uniformIndex * uniformFloats
      cursor = writeMatrix(this._uniformData, cursor, viewProjection)
      writeMatrix(this._uniformData, cursor, Matrix4x4.fromMatrix3x2(command.transform))
    })

    if (this._draws.length > 0) {
      this._device.queue.writeBuffer(
        this._uniformBuffer,
        0,
        this._uniformData,
        0,
        this._draws.length * uniformFloats,
      )
    }
  }

  private pipeline(material: GraphicMaterial): GPURenderPipeline {
    if (material.destroyed) {
      throw new Error('The material is destroyed.')
    }
    const cached = this._pipelines.get(material)
    if (cached !== undefined) return cached
    this.track(material, () => {
      this._pipelines.clear()
    })
    if (
      material.vertexShader.language !== ShaderLanguage.wgsl ||
      material.fragmentShader.language !== ShaderLanguage.wgsl
    ) {
      throw new Error('The WebGPU backend requires WGSL shader sources.')
    }
    if (material.textures.length > maxTextures) {
      throw new Error(
        `The WebGPU backend supports at most ${String(maxTextures)} texture bindings.`,
      )
    }

    const blend = blendState(material.blend)
    const pipeline = this._device.createRenderPipeline({
      layout: this._pipelineLayout,
      vertex: {
        module: createShaderModule(this._device, material.vertexShader),
        entryPoint: material.vertexShader.entryPoint,
        buffers: [
          {
            arrayStride: bytesPerVertex,
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x2' },
              { shaderLocation: 1, offset: 8, format: 'float32x2' },
              { shaderLocation: 2, offset: 16, format: 'float32x4' },
            ],
          },
        ],
      },
      fragment: {
        module: createShaderModule(this._device, material.fragmentShader),
        entryPoint: material.fragmentShader.entryPoint,
        targets: [
          {
            format: this._format,
            ...(blend === undefined ? {} : { blend }),
          },
        ],
      },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      multisample: { count: this._sampleCount },
    })
    this._pipelines.set(material, pipeline)

    return pipeline
  }

  private materialBindGroup(material: GraphicMaterial): GPUBindGroup {
    const cached = this._bindGroups.get(material)
    if (cached !== undefined) return cached
    this.track(material, () => {
      this._bindGroups.clear()
    })

    const views: GPUTextureView[] = []
    for (const binding of material.textures) {
      if (binding.texture instanceof ImageTexture) {
        views.push(this.imageTexture(binding).view)
      } else if (binding.texture instanceof RenderTarget) {
        views.push(this.targetTexture(binding.texture).view)
      } else {
        throw new Error('The WebGPU backend only supports image and render target textures.')
      }
    }

    const bindGroup = this.createMaterialBindGroup(views, material)
    this._bindGroups.set(material, bindGroup)

    return bindGroup
  }

  private imageTexture(binding: TextureBinding): GpuTexture {
    const cached = this._images.get(binding)
    if (cached !== undefined) return cached
    if (!(binding.texture instanceof ImageTexture)) {
      throw new Error('Image textures require an image source.')
    }

    const image = binding.texture.image
    this.track(binding.texture, () => {
      this.invalidateImages()
    })
    this.track(image, () => {
      this.invalidateImages()
    })
    const texture = this._device.createTexture({
      size: [image.width, image.height],
      format: image.format === RasterImageFormat.rgba8Srgb ? 'rgba8unorm-srgb' : 'rgba8unorm',
      usage: textureUsageTextureBinding | textureUsageCopyDst,
    })
    this._device.queue.writeTexture(
      { texture },
      image.data,
      { bytesPerRow: image.width * bytesPerPixel, rowsPerImage: image.height },
      { width: image.width, height: image.height },
    )
    const gpuTexture: GpuTexture = { texture, view: texture.createView() }
    this._images.set(binding, gpuTexture)

    return gpuTexture
  }

  private targetTexture(target: RenderTarget): GpuTexture {
    const cached = this._targets.get(target)
    if (cached !== undefined) return cached
    this.track(target, () => {
      this.invalidateTargets()
    })

    const texture = this._device.createTexture({
      size: [target.size.x, target.size.y],
      format: 'rgba8unorm',
      usage: textureUsageTextureBinding | textureUsageRenderAttachment | textureUsageCopyDst,
    })
    const gpuTexture: GpuTexture = { texture, view: texture.createView() }
    this._targets.set(target, gpuTexture)

    return gpuTexture
  }

  private track(resource: Resource, invalidate: () => void): void {
    if (resource.destroyed || this._tracked.has(resource)) return
    const connection = resource.onDestroyed.connect(() => {
      invalidate()
      this._tracked.delete(resource)
    })
    this._tracked.set(resource, connection)
  }

  private invalidateImages(): void {
    for (const image of this._images.values()) image.texture.destroy()
    this._images.clear()
    this._bindGroups.clear()
  }

  private invalidateTargets(): void {
    for (const target of this._targets.values()) target.texture.destroy()
    this._targets.clear()
    this._bindGroups.clear()
  }

  private msaaView(width: number, height: number): GPUTextureView {
    if (
      this._msaaTexture !== undefined &&
      this._msaaView !== undefined &&
      this._msaaWidth === width &&
      this._msaaHeight === height
    ) {
      return this._msaaView
    }

    this._msaaTexture?.destroy()
    this._msaaTexture = this._device.createTexture({
      size: [width, height],
      format: this._format,
      sampleCount: this._sampleCount,
      usage: textureUsageRenderAttachment,
    })
    this._msaaView = this._msaaTexture.createView()
    this._msaaWidth = width
    this._msaaHeight = height

    return this._msaaView
  }

  private gpuSampler(sampler: TextureSampler): GPUSampler {
    if (sampler.mipmaps) {
      throw new Error('The WebGPU backend does not support mipmapped samplers yet.')
    }

    const cached = this._samplers.get(sampler)
    if (cached !== undefined) return cached

    const gpuSampler = this._device.createSampler({
      addressModeU: addressMode(sampler.addressU),
      addressModeV: addressMode(sampler.addressV),
      magFilter: filterMode(sampler.magFilter),
      minFilter: filterMode(sampler.minFilter),
    })
    this._samplers.set(sampler, gpuSampler)

    return gpuSampler
  }

  private createMaterialBindGroup(
    views: readonly GPUTextureView[],
    material?: GraphicMaterial,
  ): GPUBindGroup {
    const entries: GPUBindGroupEntry[] = []
    for (let index = 0; index < maxTextures; index++) {
      entries.push({ binding: index, resource: views[index] ?? this._whiteImage.view })
    }
    for (let index = 0; index < maxTextures; index++) {
      const binding = material?.textures[index]
      entries.push({
        binding: maxTextures + index,
        resource: binding === undefined ? this._sampler : this.gpuSampler(binding.sampler),
      })
    }

    return this._device.createBindGroup({ layout: this._textureLayout, entries })
  }

  private syncCanvasSize(): void {
    const ratio = globalThis.devicePixelRatio
    const cssWidth = this._canvas.clientWidth || this._canvas.width
    const cssHeight = this._canvas.clientHeight || this._canvas.height
    const width = Math.max(1, Math.round(cssWidth * ratio))
    const height = Math.max(1, Math.round(cssHeight * ratio))
    if (this._canvas.width !== width || this._canvas.height !== height) {
      this._canvas.width = width
      this._canvas.height = height
    }
  }

  private gpuMesh(mesh: GraphicMesh2D): GpuMesh {
    const cached = this._meshes.get(mesh)
    if (cached !== undefined) return cached

    const vertices = new Float32Array(mesh.vertices.length * floatsPerVertex)
    mesh.vertices.forEach((vertex, index) => {
      const offset = index * floatsPerVertex
      vertices[offset] = vertex.position.x
      vertices[offset + 1] = vertex.position.y
      vertices[offset + 2] = vertex.textureCoordinate.x
      vertices[offset + 3] = vertex.textureCoordinate.y
      vertices[offset + 4] = vertex.color.r
      vertices[offset + 5] = vertex.color.g
      vertices[offset + 6] = vertex.color.b
      vertices[offset + 7] = vertex.color.a
    })
    const indices = new Uint32Array(mesh.indices)
    const vertexBuffer = this._device.createBuffer({
      size: vertices.byteLength,
      usage: bufferUsageVertex | bufferUsageCopyDst,
    })
    this._device.queue.writeBuffer(vertexBuffer, 0, vertices)
    const indexBuffer = this._device.createBuffer({
      size: indices.byteLength,
      usage: bufferUsageIndex | bufferUsageCopyDst,
    })
    this._device.queue.writeBuffer(indexBuffer, 0, indices)
    const gpuMesh: GpuMesh = { vertexBuffer, indexBuffer, indexCount: indices.length }
    this._meshes.set(mesh, gpuMesh)

    return gpuMesh
  }

  private createUniformBuffer(): GPUBuffer {
    return this._device.createBuffer({
      size: this._uniformSlots * uniformAlignment,
      usage: bufferUsageUniform | bufferUsageCopyDst,
    })
  }

  private createUniformBindGroup(index: number): GPUBindGroup {
    return this._device.createBindGroup({
      layout: this._uniformLayout,
      entries: [
        {
          binding: 0,
          resource: { buffer: this._uniformBuffer, offset: index * uniformAlignment, size: 128 },
        },
      ],
    })
  }
}

function gpuApi(): GPU | undefined {
  return navigator.gpu
}

function writeMatrix(target: Float32Array, offset: number, matrix: Matrix4x4): number {
  target.set(
    [
      matrix.m11,
      matrix.m12,
      matrix.m13,
      matrix.m14,
      matrix.m21,
      matrix.m22,
      matrix.m23,
      matrix.m24,
      matrix.m31,
      matrix.m32,
      matrix.m33,
      matrix.m34,
      matrix.m41,
      matrix.m42,
      matrix.m43,
      matrix.m44,
    ],
    offset,
  )

  return offset + 16
}

function addressMode(mode: TextureAddressMode): GPUAddressMode {
  switch (mode) {
    case TextureAddressMode.repeat:
      return 'repeat'
    case TextureAddressMode.mirroredRepeat:
      return 'mirror-repeat'
    case TextureAddressMode.clampToEdge:
      return 'clamp-to-edge'
    default:
      throw new Error('Unsupported texture address mode.')
  }
}

function filterMode(filter: TextureFilter): GPUFilterMode {
  return filter === TextureFilter.nearest ? 'nearest' : 'linear'
}

function blendState(mode: BlendMode): GPUBlendState | undefined {
  switch (mode) {
    case BlendMode.opaque:
      return undefined
    case BlendMode.alpha:
      return {
        color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha' },
        alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
      }
    case BlendMode.additive:
      return {
        color: { srcFactor: 'src-alpha', dstFactor: 'one' },
        alpha: { srcFactor: 'one', dstFactor: 'one' },
      }
    case BlendMode.multiply:
      return {
        color: { srcFactor: 'dst', dstFactor: 'zero' },
        alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
      }
    default:
      throw new Error('Unsupported blend mode.')
  }
}

function toGpuColor(color: Color): GPUColor {
  return { r: color.r, g: color.g, b: color.b, a: color.a }
}
