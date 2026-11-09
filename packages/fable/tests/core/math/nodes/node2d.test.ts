import { describe, expect, it } from 'vitest'

import { Node, Node2D, Vector2 } from '../../../../source/index.js'

describe('Node2D', () => {
  it('inherits node behavior and defaults its transformation values', () => {
    const node = new Node2D()

    expect(node).toBeInstanceOf(Node)
    expect(node.name.value).toBe('Node2D')
    expect(node.origin.value).toEqual(new Vector2(0, 0))
    expect(node.position.value).toEqual(new Vector2(0, 0))
    expect(node.rotation.value).toBe(0)
    expect(node.scale.value).toEqual(new Vector2(1, 1))
  })

  it('composes origin, scale, rotation and position into the local transform', () => {
    const node = new Node2D({
      origin: new Vector2(5, 5),
      position: new Vector2(10, 20),
      rotation: 0,
      scale: new Vector2(2, 2),
    })

    const point = node.localTransform.transform(new Vector2(5, 5))
    expect(point.x).toBeCloseTo(10)
    expect(point.y).toBeCloseTo(20)

    const scaled = node.localTransform.transform(new Vector2(10, 5))
    expect(scaled.x).toBeCloseTo(20)
    expect(scaled.y).toBeCloseTo(20)
  })

  it('caches the local transform until a local value changes', () => {
    const node = new Node2D({ position: new Vector2(1, 2) })
    const transform = node.localTransform

    expect(node.localTransform).toBe(transform)

    node.position.value = new Vector2(3, 4)
    expect(node.localTransform).not.toBe(transform)
    expect(node.localTransform.transform(new Vector2(0, 0))).toEqual(new Vector2(3, 4))
  })

  it('uses only Node2D ancestors for the global transform', () => {
    const parent = new Node2D({ name: 'parent', position: new Vector2(100, 0) })
    const middle = new Node({ name: 'middle' })
    const child = new Node2D({ name: 'child', position: new Vector2(0, 10) })
    const root = new Node2D({ name: 'root', children: [parent] })

    parent.add(middle)
    middle.add(child)

    expect(child.globalTransform.transform(new Vector2(0, 0))).toEqual(new Vector2(100, 10))
    expect(child.globalPosition).toEqual(new Vector2(100, 10))
    expect(child.parent).toBe(middle)

    root.destroy()
  })

  it('converts global positions and rotations into local values', () => {
    const parent = new Node2D({ name: 'parent', position: new Vector2(100, 0) })
    const child = new Node2D({ name: 'child' })
    parent.add(child)

    child.globalPosition = new Vector2(5, 7)
    expect(child.position.value).toEqual(new Vector2(-95, 7))
    expect(child.globalPosition).toEqual(new Vector2(5, 7))

    parent.rotation.value = Math.PI / 2
    child.globalRotation = Math.PI
    expect(child.rotation.value).toBeCloseTo(Math.PI / 2)
    expect(child.globalRotation).toBeCloseTo(Math.PI)
  })

  it('rejects global positions when the ancestor transform is singular', () => {
    const parent = new Node2D({ name: 'parent', scale: new Vector2(0, 0) })
    const child = new Node2D({ name: 'child' })
    parent.add(child)

    expect(() => {
      child.globalPosition = new Vector2(1, 1)
    }).toThrow('cannot be inverted')
  })

  it('destroys its stores with the node', () => {
    const node = new Node2D()
    const parent = new Node2D({ name: 'parent', children: [node] })

    expect(() => {
      node.destroy()
    }).toThrow('Detach')

    parent.remove(node)
    node.destroy()

    expect(node.destroyed).toBe(true)
    expect(node.origin.destroyed).toBe(true)
    expect(node.position.destroyed).toBe(true)
    expect(node.rotation.destroyed).toBe(true)
    expect(node.scale.destroyed).toBe(true)

    parent.destroy()
  })
})
