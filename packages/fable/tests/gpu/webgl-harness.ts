/* eslint-disable @typescript-eslint/naming-convention -- Properties mirror the WebGL API constants. */

import { vi } from 'vitest'

/** A recorded WebGL call. */
export interface GlCall {
  readonly name: string
  readonly args: readonly unknown[]
}

/**
 * Records WebGL 2 calls so backend behavior can be asserted without a GPU.
 *
 * The harness answers only what the backend queries (program and shader
 * status, uniform locations, framebuffer completeness) and records every call.
 */
export class FakeWebGl2 {
  public readonly calls: GlCall[] = []
  public readonly VERTEX_SHADER: number = 0x8b31
  public readonly FRAGMENT_SHADER: number = 0x8b30
  public readonly COMPILE_STATUS: number = 0x8b81
  public readonly LINK_STATUS: number = 0x8b82
  public readonly ARRAY_BUFFER: number = 0x8892
  public readonly ELEMENT_ARRAY_BUFFER: number = 0x8893
  public readonly STATIC_DRAW: number = 0x88e4
  public readonly DYNAMIC_DRAW: number = 0x88e8
  public readonly FLOAT: number = 0x1406
  public readonly TRIANGLES: number = 0x0004
  public readonly UNSIGNED_INT: number = 0x1405
  public readonly TEXTURE_2D: number = 0x0de1
  public readonly TEXTURE0: number = 0x84c0
  public readonly RGBA: number = 0x1908
  public readonly SRGB8_ALPHA8: number = 0x8c43
  public readonly UNSIGNED_BYTE: number = 0x1401
  public readonly TEXTURE_WRAP_S: number = 0x2802
  public readonly TEXTURE_WRAP_T: number = 0x2803
  public readonly TEXTURE_MIN_FILTER: number = 0x2801
  public readonly TEXTURE_MAG_FILTER: number = 0x2800
  public readonly REPEAT: number = 0x2901
  public readonly MIRRORED_REPEAT: number = 0x8370
  public readonly CLAMP_TO_EDGE: number = 0x812f
  public readonly NEAREST: number = 0x2600
  public readonly LINEAR: number = 0x2601
  public readonly NEAREST_MIPMAP_LINEAR: number = 0x2700
  public readonly LINEAR_MIPMAP_LINEAR: number = 0x2703
  public readonly BLEND: number = 0x0be2
  public readonly SRC_ALPHA: number = 0x0302
  public readonly ONE_MINUS_SRC_ALPHA: number = 0x0303
  public readonly ONE: number = 1
  public readonly DST_COLOR: number = 0x0306
  public readonly ZERO: number = 0
  public readonly COLOR_BUFFER_BIT: number = 0x4000
  public readonly FRAMEBUFFER: number = 0x8d40
  public readonly COLOR_ATTACHMENT0: number = 0x8ce0
  public readonly FRAMEBUFFER_COMPLETE: number = 0x8cd5

  public constructor() {
    return new Proxy(this, {
      get: (target, property, receiver) => {
        const value = Reflect.get(target, property, receiver)
        if (value !== undefined || typeof property !== 'string') return value

        return (...args: unknown[]): undefined => {
          target.calls.push({ name: property, args })
        }
      },
    })
  }

  /** Returns the calls with the given name, in order. */
  public callsTo(name: string): readonly GlCall[] {
    return this.calls.filter((call) => call.name === name)
  }

  public createShader(type: number): unknown {
    this.calls.push({ name: 'createShader', args: [type] })
    return { type }
  }

  public getShaderParameter(): boolean {
    return true
  }

  public getProgramParameter(): boolean {
    return true
  }

  public getShaderInfoLog(): string {
    return ''
  }

  public getProgramInfoLog(): string {
    return ''
  }

  public getUniformLocation(program: unknown, name: string): unknown {
    return { name, program }
  }

  public checkFramebufferStatus(): number {
    return this.FRAMEBUFFER_COMPLETE
  }
}

/** A fake canvas whose WebGL 2 context is the harness. */
export interface GlHarness {
  readonly canvas: HTMLCanvasElement
  readonly gl: FakeWebGl2
  readonly attributes: WebGLContextAttributes | undefined
  readonly listeners: Map<string, EventListener>
  readonly contextRequests: readonly string[]
  readonly drawCalls: readonly GlCall[]
}

/**
 * Creates a canvas harness backed by {@link FakeWebGl2}.
 *
 * @param options - Canvas size and optional client size.
 * @returns The harness with the canvas, context and recorded calls.
 */
export function createGlHarness({
  width = 100,
  height = 50,
  clientWidth = width,
  clientHeight = height,
}: {
  width?: number
  height?: number
  clientWidth?: number
  clientHeight?: number
} = {}): GlHarness {
  const gl = new FakeWebGl2()
  const listeners = new Map<string, EventListener>()
  const contextRequests: string[] = []
  let attributes: WebGLContextAttributes | undefined
  const canvas = {
    width,
    height,
    clientWidth,
    clientHeight,
    getContext: (type: string, options?: WebGLContextAttributes): unknown => {
      contextRequests.push(type)
      attributes = options
      return gl
    },
    addEventListener: vi.fn((type: string, listener: EventListener) => {
      listeners.set(type, listener)
    }),
    removeEventListener: vi.fn((type: string) => {
      listeners.delete(type)
    }),
  } as unknown as HTMLCanvasElement

  return {
    canvas,
    gl,
    get attributes() {
      return attributes
    },
    listeners,
    contextRequests,
    get drawCalls() {
      return gl.callsTo('drawElements')
    },
  }
}
