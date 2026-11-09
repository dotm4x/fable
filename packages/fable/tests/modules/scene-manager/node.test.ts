import { describe, expect, it, vi } from 'vitest'

import { Node } from '../../../source/index.js'

describe('Node', () => {
  it('manages ownership, searches and paths without permitting cycles', () => {
    const leaf = new Node({ name: 'leaf', tags: ['enemy'] })
    const child = new Node({ name: 'child', children: [leaf] })
    const root = new Node({ name: 'root', children: [child], visible: false })
    expect(leaf.parent).toBe(child)
    expect(leaf.path).toBe('root/child/leaf')
    expect(root.getByName('leaf', true)).toBe(leaf)
    expect(root.getByIdentifier(leaf.identifier, true)).toBe(leaf)
    expect(root.getByTag('enemy', true)).toEqual([leaf])
    expect(root.getByPath('child/leaf/..')).toBe(child)
    expect(root.getByPath('missing')).toBeUndefined()
    expect(root.visible.value).toBe(false)
    expect(() => {
      leaf.add(root)
    }).toThrow('cycle')
    expect(() => {
      root.add(leaf)
    }).toThrow('unowned')
    expect(() => {
      child.destroy()
    }).toThrow('Detach')
    expect(root.remove(child)).toBe(true)
    expect(child.parent).toBeUndefined()
    root.destroy()
    expect(child.destroyed).toBe(false)
    child.destroy()
    expect(leaf.destroyed).toBe(true)
  })

  it('composes once and loads children after the parent', () => {
    const calls: string[] = []
    class TestNode extends Node {
      protected override onLoad(): void {
        calls.push(this.name.value)
      }
      protected override onUnload(): void {
        calls.push(`-${this.name.value}`)
      }
    }
    const child = new TestNode({ name: 'child' })
    class Root extends TestNode {
      public count: number = 0
      protected override *compose(): Generator<Node> {
        this.count++
        yield child
      }
    }
    const root = new Root({ name: 'root' })
    root.load()
    root.unload()
    root.load()
    root.unload()
    expect(root.count).toBe(1)
    expect(calls).toEqual(['root', 'child', '-child', '-root', 'root', 'child', '-child', '-root'])
    root.destroy()
  })

  it('preserves persistent children on unload and destroys them with the owner', () => {
    const child = new Node({ persistent: true })
    const root = new Node({ children: [child] })
    root.load()
    root.unload()
    expect(child.loaded).toBe(true)
    root.destroy()
    expect(child.destroyed).toBe(true)
  })

  it('rolls back newly loaded children on failure and retains prior persistent children', () => {
    const persistent = new Node({ persistent: true })
    class Broken extends Node {
      protected override onLoad(): void {
        throw new Error('load failed')
      }
    }
    const root = new Node({ children: [persistent] })
    root.load()
    root.unload()
    root.add(new Broken())
    expect(() => {
      root.load()
    }).toThrow('load failed')
    expect(root.loaded).toBe(false)
    expect(persistent.loaded).toBe(true)
    root.destroy()
  })

  it('updates attached children immediately when loaded', () => {
    const load = vi.fn()
    class Child extends Node {
      protected override onLoad(): void {
        load()
      }
    }
    const root = new Node()
    root.load()
    const child = new Child()
    root.add(child)
    expect(load).toHaveBeenCalledOnce()
    expect(child.loaded).toBe(true)
    root.remove(child)
    expect(child.loaded).toBe(false)
    child.destroy()
    root.unload()
    root.destroy()
  })
})
