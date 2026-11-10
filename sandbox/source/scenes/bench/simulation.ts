import { Vector2 } from '@dotm4x/fable'

/** A ball bouncing inside a rectangular arena. */
export interface Ball {
  position: Vector2
  velocity: Vector2
  readonly radius: number
  readonly palette: number
}

/** Advances a set of balls inside an arena with elastic wall collisions. */
export class BallSimulation {
  public readonly balls: Ball[] = []
  public readonly width: number
  public readonly height: number

  public constructor(count: number, width: number, height: number, random = Math.random) {
    this.width = width
    this.height = height
    for (let index = 0; index < count; index++) {
      const radius = 3 + random() * 5
      this.balls.push({
        position: new Vector2(
          radius + random() * (width - radius * 2),
          radius + random() * (height - radius * 2),
        ),
        velocity: new Vector2((random() - 0.5) * 240, (random() - 0.5) * 240),
        radius,
        palette: index % 6,
      })
    }
  }

  public update(deltaTime: number): void {
    for (const ball of this.balls) this.updateBall(ball, deltaTime)
  }

  public updateBall(ball: Ball, deltaTime: number): void {
    let x = ball.position.x + ball.velocity.x * deltaTime
    let y = ball.position.y + ball.velocity.y * deltaTime
    let vx = ball.velocity.x
    let vy = ball.velocity.y
    if (x < ball.radius) {
      x = ball.radius
      vx = Math.abs(vx)
    } else if (x > this.width - ball.radius) {
      x = this.width - ball.radius
      vx = -Math.abs(vx)
    }

    if (y < ball.radius) {
      y = ball.radius
      vy = Math.abs(vy)
    } else if (y > this.height - ball.radius) {
      y = this.height - ball.radius
      vy = -Math.abs(vy)
    }

    ball.position = new Vector2(x, y)
    ball.velocity = new Vector2(vx, vy)
  }
}
