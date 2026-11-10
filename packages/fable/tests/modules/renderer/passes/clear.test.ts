import { describe, expect, it } from 'vitest'

import {
  Camera2D,
  ClearCommand,
  ClearRenderPass,
  clearRenderPassIdentifier,
  Color,
  RenderPassPriority,
  RenderSpace,
  RenderTarget,
  Vector2,
} from '../../../../source/index.js'

import { RecordingBackend } from './recording-backend.js'

describe('ClearRenderPass', () => {
  it('clears the window and each target once', () => {
    const backend = new RecordingBackend()
    const target = new RenderTarget(new Vector2(32, 16))
    const camera = new Camera2D()
    const spaces = [
      new RenderSpace({ identifier: 'window', camera }),
      new RenderSpace({ identifier: 'first', camera, target }),
      new RenderSpace({ identifier: 'second', camera, target }),
    ]

    backend.beginFrame()
    new ClearRenderPass().execute({ backend, deltaTime: 0, clearColor: Color.black, spaces })
    backend.endFrame()

    expect(backend.rendered).toEqual([
      [new ClearCommand(Color.black)],
      [new ClearCommand(Color.black)],
    ])
    expect(backend.targets).toEqual([undefined, target])
    target.destroy()
    for (const space of spaces) space.destroy()
  })

  it('exposes its identifier and default priority', () => {
    const pass = new ClearRenderPass()

    expect(pass.identifier).toBe(clearRenderPassIdentifier)
    expect(pass.priority).toBe(RenderPassPriority.low)
    pass.destroy()
  })
})
