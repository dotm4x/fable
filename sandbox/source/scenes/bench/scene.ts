import {
  type Camera2D,
  Color,
  Draw2DCommand,
  type Drawable,
  DrawData,
  type GraphicMaterial,
  GraphicMesh2D,
  GraphicVertex2D,
  Matrix3x2,
  Node2D,
  type Updatable,
  type UpdateContext,
  Vector2,
} from '@dotm4x/fable'

import { BallSimulation } from './simulation.js'

/** Benchmark data published on the window for measurement tools. */
export interface BallsBenchmark {
  readonly mode: string
  readonly count: number
  readonly nodes: number
  readonly frames: number
  readonly elapsed: number
  readonly fps: number
  readonly drawCalls?: number
  readonly commands?: number
}

declare global {
  interface Window {
    ballsFrameStats?: BallsBenchmark
  }
}

export type BallsMode = 'single' | 'nodes'

const palette: readonly Color[] = [
  new Color(0.95, 0.3, 0.3),
  new Color(0.95, 0.65, 0.25),
  new Color(0.9, 0.9, 0.3),
  new Color(0.35, 0.85, 0.45),
  new Color(0.3, 0.65, 0.95),
  new Color(0.7, 0.4, 0.95),
]

const arenaWidth = 620
const arenaHeight = 340
const left = -arenaWidth / 2
const top = -arenaHeight / 2

function createQuad(color: Color): GraphicMesh2D {
  return new GraphicMesh2D(
    [
      new GraphicVertex2D(new Vector2(-0.5, -0.5), new Vector2(0, 0), color),
      new GraphicVertex2D(new Vector2(0.5, -0.5), new Vector2(1, 0), color),
      new GraphicVertex2D(new Vector2(0.5, 0.5), new Vector2(1, 1), color),
      new GraphicVertex2D(new Vector2(-0.5, 0.5), new Vector2(0, 1), color),
    ],
    [0, 1, 2, 0, 2, 3],
  )
}

function transformOf(x: number, y: number, radius: number): Matrix3x2 {
  return Matrix3x2.scaling(radius * 2, radius * 2).multiply(Matrix3x2.translation(x, y))
}

function worldX(ball: { position: Vector2 }): number {
  return left + ball.position.x
}

function worldY(ball: { position: Vector2 }): number {
  return top + ball.position.y
}

/** One node that updates and draws every ball. */
export class BallsNode extends Node2D implements Drawable, Updatable {
  private readonly _balls: BallSimulation
  private readonly _material: GraphicMaterial
  private readonly _meshes: readonly GraphicMesh2D[]

  public constructor(simulation: BallSimulation, material: GraphicMaterial) {
    super({ name: 'balls' })
    this._balls = simulation
    this._material = material
    this._meshes = palette.map((color) => createQuad(color))
  }

  public update(context: UpdateContext): void {
    this._balls.update(context.deltaTime)
  }

  public draw(): DrawData {
    const commands: Draw2DCommand[] = []
    for (const ball of this._balls.balls) {
      const mesh = this._meshes[ball.palette] ?? this._meshes[0]
      if (mesh === undefined) continue
      commands.push(
        new Draw2DCommand({
          mesh,
          material: this._material,
          transform: transformOf(worldX(ball), worldY(ball), ball.radius),
        }),
      )
    }

    return new DrawData(commands)
  }
}

/** One node per ball, each updating and drawing its own state. */
export class BallNode extends Node2D implements Drawable, Updatable {
  private readonly _simulation: BallSimulation
  private readonly _index: number
  private readonly _material: GraphicMaterial
  private readonly _meshes: readonly GraphicMesh2D[]

  public constructor(
    simulation: BallSimulation,
    index: number,
    material: GraphicMaterial,
    meshes: readonly GraphicMesh2D[],
  ) {
    super({ name: `ball-${String(index)}` })
    this._simulation = simulation
    this._index = index
    this._material = material
    this._meshes = meshes
  }

  public update(context: UpdateContext): void {
    const ball = this._simulation.balls[this._index]
    if (ball === undefined) return
    this._simulation.updateBall(ball, context.deltaTime)
  }

  public draw(): DrawData {
    const ball = this._simulation.balls[this._index]
    if (ball === undefined) return new DrawData([])
    const mesh = this._meshes[ball.palette] ?? this._meshes[0]
    if (mesh === undefined) return new DrawData([])

    return new DrawData([
      new Draw2DCommand({
        mesh,
        material: this._material,
        transform: transformOf(worldX(ball), worldY(ball), ball.radius),
      }),
    ])
  }
}

/** Scene that renders a configurable number of bouncing balls. */
export class BallsScene extends Node2D implements Updatable {
  public readonly camera: Camera2D
  public readonly mode: BallsMode
  public readonly count: number
  private readonly _started: number = performance.now()
  private _frames: number = 0
  private _windowFrames: number = 0
  private _windowStart: number = performance.now()

  public constructor(material: GraphicMaterial, camera: Camera2D, mode: BallsMode, count: number) {
    const simulation = new BallSimulation(count, arenaWidth, arenaHeight)
    const meshes = palette.map((color) => createQuad(color))
    const children: Node2D[] = []
    if (mode === 'single') {
      children.push(new BallsNode(simulation, material))
    } else {
      for (let index = 0; index < count; index++) {
        children.push(new BallNode(simulation, index, material, meshes))
      }
    }

    super({ name: 'balls', children })
    this.camera = camera
    this.mode = mode
    this.count = count
  }

  public update(): void {
    this._frames++
    this._windowFrames++
    const now = performance.now()
    if (now - this._windowStart < 500) return
    const fps = (this._windowFrames * 1000) / (now - this._windowStart)
    window.ballsFrameStats = {
      mode: this.mode,
      count: this.count,
      nodes: this.mode === 'single' ? 1 : this.count,
      frames: this._frames,
      elapsed: (now - this._started) / 1000,
      fps,
    }
    const output = document.querySelector('#fps')
    if (output !== null) output.textContent = fps.toFixed(1)
    this._windowFrames = 0
    this._windowStart = now
  }
}
