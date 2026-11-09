import { describe, expect, it } from 'vitest'

import {
  Destroyable,
  type DestroyableLifecycle,
  type ReadOnlyDestroyable,
} from '../../../source/index.js'

describe('Destroyable', () => {
  it('exposes its lifecycle state through read-only and destroyable contracts', () => {
    const object = new TestDestroyable()
    const readOnly: ReadOnlyDestroyable = object
    const destroyable: DestroyableLifecycle = object

    expect(readOnly.destroyed).toBe(false)
    destroyable.destroy()
    expect(readOnly.destroyed).toBe(true)
  })

  it('runs cleanup before marking the object as destroyed', () => {
    const object = new TestDestroyable()
    const statesDuringCleanup: boolean[] = []
    object.onCleanup = () => {
      statesDuringCleanup.push(object.destroyed)
    }

    object.destroy()

    expect(statesDuringCleanup).toEqual([false])
    expect(object.destroyed).toBe(true)
  })

  it('remains undestroyed when cleanup throws', () => {
    const object = new TestDestroyable()
    object.onCleanup = () => {
      throw new Error('Cleanup failed.')
    }

    expect(() => {
      object.destroy()
    }).toThrow('Cleanup failed.')
    expect(object.destroyed).toBe(false)
  })

  it('rejects repeated destruction and use after destruction', () => {
    const object = new TestDestroyable()
    object.destroy()

    expect(() => {
      object.destroy()
    }).toThrow(Error)
    expect(() => {
      object.ensureNotDestroyed()
    }).toThrow(Error)
  })

  it('rejects recursive destruction and allows a retry after cleanup fails', () => {
    const object = new TestDestroyable()
    object.onCleanup = () => {
      object.destroy()
    }

    expect(() => {
      object.destroy()
    }).toThrow('already being destroyed')
    expect(object.destroyed).toBe(false)
    object.onCleanup = undefined
    object.destroy()
    expect(object.destroyed).toBe(true)
  })
})

class TestDestroyable extends Destroyable {
  public onCleanup: (() => void) | undefined

  public ensureNotDestroyed(): void {
    this.throwIfDestroyed()
  }

  protected override onDestroy(): void {
    this.onCleanup?.()
  }
}
