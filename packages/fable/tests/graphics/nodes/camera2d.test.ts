import { describe, expect, it } from 'vitest'

import { Camera2D, Vector2, Vector4, Viewport } from '../../../source/index.js'

describe('Camera2D', () => {
  it('derives the view from the global position and rotation', () => {
    const camera = new Camera2D({ position: new Vector2(10, 20) })
    const view = camera.view

    expect(view.transform(new Vector4(10, 20, 0, 1))).toEqual(new Vector4(0, 0, 0, 1))
    expect(view.transform(new Vector4(15, 20, 0, 1))).toEqual(new Vector4(5, 0, 0, 1))
  })

  it('creates an orthographic projection centered on the viewport', () => {
    const camera = new Camera2D()
    const viewport = new Viewport(new Vector2(0, 0), new Vector2(640, 360))
    const projection = camera.getProjection(viewport)

    expect(projection.m11).toBeCloseTo(2 / 640)
    expect(projection.m22).toBeCloseTo(-2 / 360)
    expect(projection.m41).toBeCloseTo(0)
    expect(projection.m42).toBeCloseTo(0)
  })

  it('scales the projection with the zoom', () => {
    const camera = new Camera2D({ zoom: 2 })
    const projection = camera.getProjection(new Viewport(new Vector2(0, 0), new Vector2(640, 360)))

    expect(projection.m11).toBeCloseTo(2 / 320)
    expect(projection.m22).toBeCloseTo(-2 / 180)
  })

  it('rejects invalid zoom values and restores the previous one', () => {
    const camera = new Camera2D()

    expect(() => {
      camera.zoom.value = 0
    }).toThrow('greater than zero')
    expect(camera.zoom.value).toBe(1)

    expect(() => {
      camera.zoom.value = Number.NaN
    }).toThrow('greater than zero')
    expect(camera.zoom.value).toBe(1)
  })

  it('destroys its zoom store with the node', () => {
    const camera = new Camera2D()

    camera.destroy()

    expect(camera.destroyed).toBe(true)
    expect(camera.zoom.destroyed).toBe(true)
  })
})
