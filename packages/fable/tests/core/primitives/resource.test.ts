import { describe, expect, it, vi } from 'vitest'

import { Resource } from '../../../source/index.js'

class TestResource extends Resource {}

describe('Resource', () => {
  it('notifies destruction before the resource is marked as destroyed', () => {
    const resource = new TestResource()
    const listener = vi.fn()

    resource.onDestroyed.connect(listener)
    resource.destroy()

    expect(listener).toHaveBeenCalledExactlyOnceWith(resource)
    expect(resource.destroyed).toBe(true)
    expect(resource.onDestroyed.destroyed).toBe(true)
  })

  it('destroys its notification channel without being destroyed externally', () => {
    const resource = new TestResource()

    expect(resource.onDestroyed.destroyed).toBe(false)
    resource.destroy()
    expect(resource.onDestroyed.destroyed).toBe(true)
  })
})
