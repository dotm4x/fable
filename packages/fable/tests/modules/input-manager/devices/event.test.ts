import { describe, expect, it, vi } from 'vitest'

import { InputEvent } from '../../../../source/index.js'

describe('InputEvent', () => {
  it('stores a rebindable source and destroys its resources', () => {
    const action = new InputEvent<{ key: string; down: boolean; repeat: boolean }, string>({
      identifier: 'jump',
      source: 'Space',
    })
    const callback = vi.fn()
    action.connect(callback)
    action.source.value = 'KeyJ'
    action.fire({ key: 'KeyJ', down: true, repeat: false })
    expect(callback).toHaveBeenCalledOnce()
    action.destroy()
    expect(action.source.destroyed).toBe(true)
    expect(() => {
      action.fire({ key: 'KeyJ', down: false, repeat: false })
    }).toThrow()
  })
})
