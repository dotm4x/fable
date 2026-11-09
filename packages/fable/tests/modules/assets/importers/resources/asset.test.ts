import { describe, expect, it, vi } from 'vitest'

import { Asset } from '../../../../../source/index.js'

describe('Asset', () => {
  it('exposes its identifier and value', () => {
    const asset = new Asset({ identifier: 'data.txt', value: 'text' })

    expect(asset.identifier).toBe('data.txt')
    expect(asset.value).toBe('text')
    expect(asset.destroyed).toBe(false)
  })

  it('releases its value once when destroyed', () => {
    const release = vi.fn()
    const asset = new Asset({ identifier: 'data.txt', value: 'text', release })

    asset.destroy()

    expect(asset.destroyed).toBe(true)
    expect(release).toHaveBeenCalledOnce()
    expect(() => {
      asset.destroy()
    }).toThrow('already been destroyed')
  })
})
