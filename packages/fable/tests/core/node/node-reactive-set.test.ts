import { describe, expect, it, vi } from 'vitest'

import { Node, NodeReactiveSet } from '../../../source/index.js'

describe('NodeReactiveSet', () => {
  it('exposes a stable collection and notifies after hierarchy changes', () => {
    const root = new Node()
    const child = new Node()
    const added = vi.fn(() => {
      expect(child.parent).toBe(root)
      expect(root.children.has(child)).toBe(true)
    })
    const deleted = vi.fn(() => {
      expect(child.parent).toBeUndefined()
      expect(root.children.has(child)).toBe(false)
    })
    const children = root.children
    expect(children).toBeInstanceOf(NodeReactiveSet)
    children.onAdd.connect(added)
    children.onDelete.connect(deleted)
    expect(children.add(child)).toBe(children)
    children.add(child)
    expect(added).toHaveBeenCalledOnce()
    expect(root.children).toBe(children)
    expect([...children]).toEqual([child])
    expect(children.size).toBe(1)
    expect(children.delete(child)).toBe(true)
    expect(children.delete(child)).toBe(false)
    expect(deleted).toHaveBeenCalledOnce()
    child.destroy()
    root.destroy()
    expect(children.onAdd.destroyed).toBe(true)
    expect(children.onDelete.destroyed).toBe(true)
  })

  it('shares notifications with the existing node methods and preserves mutation on listener errors', () => {
    const root = new Node()
    const child = new Node()
    const connection = root.children.onAdd.connect(() => {
      throw new Error('listener failed')
    })
    expect(() => {
      root.add(child)
    }).toThrow('listener failed')
    expect(child.parent).toBe(root)
    expect(root.children.has(child)).toBe(true)
    connection.disconnect()
    expect(root.remove(child)).toBe(true)
    child.destroy()
    root.destroy()
  })

  it('searches direct and recursive children and resolves owner-relative paths', () => {
    const leaf = new Node({ name: 'leaf', tags: ['tag'] })
    const child = new Node({ name: 'child', children: [leaf] })
    const root = new Node({ children: [child] })
    expect(root.children.getByName('leaf')).toBeUndefined()
    expect(root.children.getByName('leaf', true)).toBe(leaf)
    expect(root.children.getByIdentifier(leaf.identifier, true)).toBe(leaf)
    expect(root.children.getByTag('tag', true)).toEqual([leaf])
    expect(root.children.getByPath('child/leaf/..')).toBe(child)
    root.destroy()
  })

  it('clears by detaching nodes without destroying them', () => {
    const first = new Node()
    const second = new Node()
    const root = new Node({ children: [first, second] })
    const deleted = vi.fn()
    root.children.onDelete.connect(deleted)
    root.children.clear()
    expect(root.children.size).toBe(0)
    expect(deleted).toHaveBeenCalledTimes(2)
    expect(first.parent).toBeUndefined()
    expect(second.parent).toBeUndefined()
    root.destroy()
    expect(first.destroyed).toBe(false)
    first.destroy()
    second.destroy()
  })

  it('leaves remaining children attached if a clear notification fails', () => {
    const first = new Node()
    const second = new Node()
    const root = new Node({ children: [first, second] })
    const connection = root.children.onDelete.connect(() => {
      throw new Error('listener failed')
    })
    expect(() => {
      root.children.clear()
    }).toThrow('listener failed')
    expect(first.parent).toBeUndefined()
    expect(second.parent).toBe(root)
    connection.disconnect()
    first.destroy()
    root.destroy()
  })

  it('rejects invalid ownership and reports deletion during destruction', () => {
    const child = new Node()
    const root = new Node({ children: [child] })
    const other = new Node()
    expect(() => {
      other.children.add(child)
    }).toThrow('unowned')
    const deleted = vi.fn()
    root.children.onDelete.connect(deleted)
    root.destroy()
    expect(deleted).toHaveBeenCalledWith(child)
    expect(child.destroyed).toBe(true)
    other.destroy()
  })

  it('allows destruction to be retried after a deletion listener fails', () => {
    const first = new Node()
    const second = new Node()
    const root = new Node({ children: [first, second] })
    const connection = root.children.onDelete.connect(() => {
      throw new Error('listener failed')
    })
    expect(() => {
      root.destroy()
    }).toThrow('listener failed')
    expect(root.destroyed).toBe(false)
    expect(second.destroyed).toBe(true)
    expect([...root.children]).toEqual([first])
    connection.disconnect()
    root.destroy()
    expect(first.destroyed).toBe(true)
    expect(root.destroyed).toBe(true)
  })

  it('rejects reentrant additions and loading while destroying', () => {
    const root = new Node({ children: [new Node()] })
    const extra = new Node()
    root.children.onDelete.connect(() => {
      expect(() => {
        root.children.add(extra)
      }).toThrow('destroying')
      expect(() => {
        root.load()
      }).toThrow()
    })
    root.destroy()
    expect(extra.parent).toBeUndefined()
    extra.destroy()
  })

  it('allows unload hooks to detach children during destruction', () => {
    const child = new Node()
    class Parent extends Node {
      protected override onUnload(): void {
        this.children.delete(child)
      }
    }
    const root = new Parent({ children: [child] })
    root.load()
    root.destroy()
    expect(child.parent).toBeUndefined()
    expect(child.destroyed).toBe(false)
    child.destroy()
  })

  it('retains failed attachments when rollback leaves the child loaded', () => {
    class Broken extends Node {
      protected override onLoad(): void {
        throw new Error('load failed')
      }
    }
    class CleanupFailure extends Node {
      private _failed: boolean = false
      protected override onUnload(): void {
        if (!this._failed) {
          this._failed = true
          throw new Error('cleanup failed')
        }
      }
    }
    const root = new Node()
    root.load()
    const child = new Node({ children: [new CleanupFailure(), new Broken()] })
    const added = vi.fn()
    root.children.onAdd.connect(added)
    expect(() => {
      root.children.add(child)
    }).toThrow(AggregateError)
    expect(child.loaded).toBe(true)
    expect(child.parent).toBe(root)
    expect(added).toHaveBeenCalledWith(child)
    root.unload()
    root.destroy()
  })
})
