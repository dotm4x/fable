import {
  type Camera2D,
  Color,
  Draw2DCommand,
  type Drawable,
  DrawData,
  type GraphicMaterial,
  GraphicMesh2D,
  GraphicVertex2D,
  type KeyboardInputEvent,
  Matrix3x2,
  Node2D,
  type Updatable,
  type UpdateContext,
  Vector2,
} from '@dotm4x/fable'

import { MyInputModule } from '../../input/module.js'

import { SnakeDirection, SnakeGame, SnakeState } from './game.js'

const cellSize = 20

const colors = {
  border: new Color(0.16, 0.2, 0.28),
  board: new Color(0.05, 0.07, 0.1),
  body: new Color(0.16, 0.62, 0.33),
  head: new Color(0.38, 0.92, 0.52),
  food: new Color(0.92, 0.3, 0.24),
}

interface SnakeMeshes {
  readonly border: GraphicMesh2D
  readonly board: GraphicMesh2D
  readonly body: GraphicMesh2D
  readonly head: GraphicMesh2D
  readonly food: GraphicMesh2D
}

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

/** Draws and steers a snake game inside the scene. */
export class SnakeNode extends Node2D implements Drawable, Updatable {
  private readonly _game: SnakeGame
  private readonly _material: GraphicMaterial
  private readonly _meshes: SnakeMeshes = {
    border: createQuad(colors.border),
    board: createQuad(colors.board),
    body: createQuad(colors.body),
    head: createQuad(colors.head),
    food: createQuad(colors.food),
  }

  public constructor(game: SnakeGame, material: GraphicMaterial) {
    super({ name: 'snake-board' })
    this._game = game
    this._material = material
  }

  public update(context: UpdateContext): void {
    this._game.update(context.deltaTime)
    this.syncStatus()
  }

  public draw(): DrawData {
    const game = this._game
    const commands: Draw2DCommand[] = [
      this.command(this._meshes.border, game.columns * cellSize + 8, game.rows * cellSize + 8),
      this.command(this._meshes.board, game.columns * cellSize, game.rows * cellSize),
      this.commandAt(this._meshes.food, game.food.x, game.food.y, cellSize * 0.6),
    ]
    game.snake.forEach((cell, index) => {
      const size = index === 0 ? cellSize - 1 : cellSize - 3
      const mesh = index === 0 ? this._meshes.head : this._meshes.body
      commands.push(this.commandAt(mesh, cell.x, cell.y, size))
    })

    return new DrawData(commands)
  }

  private command(mesh: GraphicMesh2D, width: number, height: number): Draw2DCommand {
    return new Draw2DCommand({
      mesh,
      material: this._material,
      transform: Matrix3x2.scaling(width, height),
    })
  }

  private commandAt(mesh: GraphicMesh2D, column: number, row: number, size: number): Draw2DCommand {
    const x = (column - this._game.columns / 2 + 0.5) * cellSize
    const y = (row - this._game.rows / 2 + 0.5) * cellSize

    return new Draw2DCommand({
      mesh,
      material: this._material,
      transform: Matrix3x2.scaling(size, size).multiply(Matrix3x2.translation(x, y)),
    })
  }

  private syncStatus(): void {
    const score = document.querySelector('#score')
    if (score !== null) score.textContent = String(this._game.score)

    const status = document.querySelector('#status')
    if (status === null) return
    switch (this._game.state) {
      case SnakeState.ready:
        status.textContent = 'Arrows or WASD to start'
        break
      case SnakeState.paused:
        status.textContent = 'Paused — Space to resume'
        break
      case SnakeState.over:
        status.textContent = `Game over — score ${String(this._game.score)}. R to restart`
        break
      case SnakeState.running:
        status.textContent = ''
    }
  }
}

/** Scene that hosts the playable snake game. */
export class SnakeScene extends Node2D {
  public readonly camera: Camera2D
  public readonly game: SnakeGame

  public constructor(material: GraphicMaterial, camera: Camera2D) {
    const game = new SnakeGame()
    super({ name: 'snake', children: [new SnakeNode(game, material)] })
    this.camera = camera
    this.game = game
  }

  protected override configure(): void {
    const keyboard = this.require(MyInputModule).keyboard
    const steer = (event: KeyboardInputEvent, direction: SnakeDirection): void => {
      event.connect(({ down, repeat }) => {
        if (!down || repeat) return
        this.game.start()
        this.game.queueDirection(direction)
      })
    }

    steer(keyboard.up, SnakeDirection.up)
    steer(keyboard.down, SnakeDirection.down)
    steer(keyboard.left, SnakeDirection.left)
    steer(keyboard.right, SnakeDirection.right)
    steer(keyboard.w, SnakeDirection.up)
    steer(keyboard.s, SnakeDirection.down)
    steer(keyboard.a, SnakeDirection.left)
    steer(keyboard.d, SnakeDirection.right)

    keyboard.space.connect(({ down, repeat }) => {
      if (!down || repeat) return
      if (this.game.state === SnakeState.over) {
        this.game.reset()
        this.game.start()
      } else if (this.game.state === SnakeState.ready) {
        this.game.start()
      } else {
        this.game.togglePause()
      }
    })

    keyboard.restart.connect(({ down, repeat }) => {
      if (!down || repeat) return
      this.game.reset()
      this.game.start()
    })
  }
}
