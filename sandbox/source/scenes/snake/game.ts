import { Vector2 } from '@dotm4x/fable'

/** Direction in which the snake moves. */
export enum SnakeDirection {
  up = 'up',
  down = 'down',
  left = 'left',
  right = 'right',
}

/** Lifecycle state of the snake game. */
export enum SnakeState {
  ready = 'ready',
  running = 'running',
  paused = 'paused',
  over = 'over',
}

/** Configuration for a snake game. */
export interface SnakeGameOptions {
  readonly columns?: number
  readonly rows?: number
  readonly initialLength?: number
  readonly cellsPerSecond?: number
  readonly scorePerFood?: number
  readonly random?: () => number
}

function isOpposite(left: SnakeDirection, right: SnakeDirection): boolean {
  switch (left) {
    case SnakeDirection.up:
      return right === SnakeDirection.down
    case SnakeDirection.down:
      return right === SnakeDirection.up
    case SnakeDirection.left:
      return right === SnakeDirection.right
    case SnakeDirection.right:
      return right === SnakeDirection.left
    default:
      return false
  }
}

/** Engine-agnostic snake game over a rectangular grid. */
export class SnakeGame {
  private readonly _columns: number
  private readonly _rows: number
  private readonly _initialLength: number
  private readonly _interval: number
  private readonly _scorePerFood: number
  private readonly _random: () => number
  private _snake: Vector2[] = []
  private _food: Vector2 = new Vector2(0, 0)
  private _direction: SnakeDirection = SnakeDirection.right
  private _queued: SnakeDirection[] = []
  private _score: number = 0
  private _state: SnakeState = SnakeState.ready
  private _elapsed: number = 0

  public constructor({
    columns = 20,
    rows = 15,
    initialLength = 4,
    cellsPerSecond = 8,
    scorePerFood = 10,
    random = Math.random,
  }: SnakeGameOptions = {}) {
    if (!Number.isInteger(columns) || columns < 4) {
      throw new RangeError('The board must have at least four columns.')
    }

    if (!Number.isInteger(rows) || rows < 4) {
      throw new RangeError('The board must have at least four rows.')
    }

    if (!Number.isInteger(initialLength) || initialLength < 1 || initialLength > columns) {
      throw new RangeError('The initial length must fit the board.')
    }

    if (!Number.isFinite(cellsPerSecond) || cellsPerSecond <= 0) {
      throw new RangeError('The snake speed must be greater than zero.')
    }

    if (!Number.isInteger(scorePerFood) || scorePerFood < 0) {
      throw new RangeError('The score per food must be a nonnegative integer.')
    }

    this._columns = columns
    this._rows = rows
    this._initialLength = initialLength
    this._interval = 1 / cellsPerSecond
    this._scorePerFood = scorePerFood
    this._random = random
    this.reset()
  }

  public get columns(): number {
    return this._columns
  }

  public get rows(): number {
    return this._rows
  }

  public get direction(): SnakeDirection {
    return this._direction
  }

  public get food(): Vector2 {
    return this._food
  }

  public get score(): number {
    return this._score
  }

  public get state(): SnakeState {
    return this._state
  }

  public get snake(): readonly Vector2[] {
    return this._snake
  }

  private get running(): boolean {
    return this._state === SnakeState.running
  }

  public reset(): void {
    const row = Math.floor(this._rows / 2)
    const head = Math.max(this._initialLength - 1, Math.floor(this._columns / 2))
    this._snake = []
    for (let index = 0; index < this._initialLength; index++) {
      this._snake.push(new Vector2(head - index, row))
    }

    this._direction = SnakeDirection.right
    this._queued = []
    this._score = 0
    this._elapsed = 0
    this._state = SnakeState.ready
    this.placeFood()
  }

  public start(): void {
    if (this._state === SnakeState.over) this.reset()
    this._state = SnakeState.running
  }

  public pause(): void {
    if (this._state === SnakeState.running) this._state = SnakeState.paused
  }

  public resume(): void {
    if (this._state === SnakeState.paused) this._state = SnakeState.running
  }

  public togglePause(): void {
    if (this._state === SnakeState.running) this.pause()
    else this.resume()
  }

  public queueDirection(direction: SnakeDirection): boolean {
    if (this._state === SnakeState.over) return false
    const previous = this._queued[this._queued.length - 1] ?? this._direction
    if (direction === previous || isOpposite(direction, previous)) return false
    this._queued.push(direction)

    return true
  }

  public update(deltaTime: number): void {
    if (this._state !== SnakeState.running || !Number.isFinite(deltaTime) || deltaTime <= 0) {
      return
    }

    this._elapsed += deltaTime
    let steps = 0
    const maxSteps = this._columns * this._rows
    while (this._elapsed >= this._interval && this.running) {
      this._elapsed -= this._interval
      this.step()
      steps++
      if (steps >= maxSteps) break
    }
  }

  public step(): void {
    if (this._state !== SnakeState.running) return
    const queued = this._queued.shift()
    if (queued !== undefined) this._direction = queued
    const head = this._snake[0]
    if (head === undefined) return
    const target = this.nextCell(head, this._direction)
    const eating = target.equals(this._food)
    const body = eating ? this._snake : this._snake.slice(0, -1)
    if (!this.isInside(target) || body.some((cell) => cell.equals(target))) {
      this._state = SnakeState.over

      return
    }

    this._snake.unshift(target)
    if (eating) {
      this._score += this._scorePerFood
      this.placeFood()
    } else {
      this._snake.pop()
    }
  }

  private nextCell(cell: Vector2, direction: SnakeDirection): Vector2 {
    switch (direction) {
      case SnakeDirection.up:
        return new Vector2(cell.x, cell.y - 1)
      case SnakeDirection.down:
        return new Vector2(cell.x, cell.y + 1)
      case SnakeDirection.left:
        return new Vector2(cell.x - 1, cell.y)
      case SnakeDirection.right:
        return new Vector2(cell.x + 1, cell.y)
      default:
        return cell
    }
  }

  private isInside(cell: Vector2): boolean {
    return (
      Number.isInteger(cell.x) &&
      Number.isInteger(cell.y) &&
      cell.x >= 0 &&
      cell.y >= 0 &&
      cell.x < this._columns &&
      cell.y < this._rows
    )
  }

  private placeFood(): void {
    const free: Vector2[] = []
    for (let y = 0; y < this._rows; y++) {
      for (let x = 0; x < this._columns; x++) {
        const cell = new Vector2(x, y)
        if (!this._snake.some((segment) => segment.equals(cell))) free.push(cell)
      }
    }

    if (free.length === 0) {
      this._state = SnakeState.over

      return
    }

    const index = Math.min(free.length - 1, Math.floor(this._random() * free.length))
    this._food = free[index] ?? new Vector2(0, 0)
  }
}
