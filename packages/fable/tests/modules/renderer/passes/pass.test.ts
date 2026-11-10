import { describe, expect, it } from 'vitest'

import { RenderPass, type RenderPassContext, RenderPassPriority } from '../../../../source/index.js'

class TestPass extends RenderPass {
  public readonly contexts: RenderPassContext[] = []

  public constructor(identifier: string = 'pass', priority?: RenderPassPriority) {
    super(identifier, priority)
  }

  public execute(context: RenderPassContext): void {
    this.throwIfDestroyed()
    this.contexts.push(context)
  }
}

describe('RenderPass', () => {
  it('exposes its identifier and priority', () => {
    const pass = new TestPass('custom', RenderPassPriority.high)
    const defaultPass = new TestPass()

    expect(pass.identifier).toBe('custom')
    expect(pass.priority).toBe(RenderPassPriority.high)
    expect(defaultPass.priority).toBe(RenderPassPriority.normal)
    pass.destroy()
    defaultPass.destroy()
  })

  it('rejects empty identifiers', () => {
    expect(() => new TestPass('')).toThrow('must not be empty')
  })

  it('refuses to execute once destroyed', () => {
    const pass = new TestPass()
    pass.destroy()

    expect(() => {
      pass.execute({
        backend: undefined as never,
        deltaTime: 0,
        clearColor: undefined as never,
        spaces: [],
      })
    }).toThrow('destroyed')
  })
})
