import { describe, expect, it } from 'vitest'

import {
  Color,
  GraphicMaterial,
  Shader,
  ShaderLanguage,
  ShaderStage,
  SpriteNode,
  Vector2,
} from '../../../source/index.js'

function createMaterial(): GraphicMaterial {
  return new GraphicMaterial({
    vertexShader: new Shader({
      code: 'vertex',
      language: ShaderLanguage.glsl,
      stage: ShaderStage.vertex,
    }),
    fragmentShader: new Shader({
      code: 'fragment',
      language: ShaderLanguage.glsl,
      stage: ShaderStage.fragment,
    }),
  })
}

describe('SpriteNode', () => {
  it('builds a textured quad with the requested atlas region', () => {
    const material = createMaterial()
    const sprite = new SpriteNode({
      name: 'sprite',
      material,
      size: new Vector2(100, 50),
      region: { min: new Vector2(0.5, 0), max: new Vector2(1, 0.5) },
      order: 3,
    })

    const data = sprite.draw()
    const command = data.commands[0]

    expect(command).toBeDefined()
    expect(data.commands).toHaveLength(1)
    const mesh = (
      command as {
        mesh: {
          vertices: readonly { position: Vector2; textureCoordinate: Vector2 }[]
          indices: readonly number[]
        }
      }
    ).mesh
    expect(mesh.vertices).toHaveLength(4)
    expect(mesh.indices).toEqual([0, 1, 2, 0, 2, 3])
    expect(mesh.vertices[0]?.position).toEqual(new Vector2(-50, -25))
    expect(mesh.vertices[0]?.textureCoordinate).toEqual(new Vector2(0.5, 0))
    expect(mesh.vertices[2]?.textureCoordinate).toEqual(new Vector2(1, 0.5))
    expect((command as { order: number }).order).toBe(3)
    sprite.destroy()
  })

  it('defaults to the whole texture and white vertices', () => {
    const sprite = new SpriteNode({
      material: createMaterial(),
      size: new Vector2(2, 2),
    })
    const command = sprite.draw().commands[0] as {
      mesh: { vertices: readonly { color: Color; textureCoordinate: Vector2 }[] }
    }

    expect(command.mesh.vertices[0]?.textureCoordinate).toEqual(new Vector2(0, 0))
    expect(command.mesh.vertices[2]?.textureCoordinate).toEqual(new Vector2(1, 1))
    expect(command.mesh.vertices[0]?.color).toEqual(Color.white)
    sprite.destroy()
  })

  it('rejects invalid atlas regions', () => {
    expect(
      () =>
        new SpriteNode({
          material: createMaterial(),
          size: new Vector2(1, 1),
          region: { min: new Vector2(-0.1, 0), max: new Vector2(1, 1) },
        }),
    ).toThrow('normalized')
    expect(
      () =>
        new SpriteNode({
          material: createMaterial(),
          size: new Vector2(1, 1),
          region: { min: new Vector2(1, 1), max: new Vector2(0, 0) },
        }),
    ).toThrow('inverted')
  })
})
