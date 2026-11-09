import {
  Channel,
  ChannelPriority,
  Game,
  type Module,
  Scheduler,
  type Updatable,
  type UpdateContext,
} from '@dotm4x/fable'

class MyScheduler extends Scheduler {
  public main: Channel

  public constructor(game: MyGame) {
    super()
    this.main = new Channel({
      identifier: 'main',
      targetUpdateRate: 60,
      priority: ChannelPriority.normal,
      entries: [game],
    })
  }

  protected override *compose(): Generator<Channel> {
    yield this.main
  }
}

class MyGame extends Game implements Updatable {
  public scheduler: MyScheduler

  public constructor() {
    super()
    this.scheduler = new MyScheduler(this)
  }

  protected override *compose(): Generator<Module> {
    yield this.scheduler
  }

  public update(context: UpdateContext): void {
    console.warn(`update: ${String(context.deltaTime)}`)
  }
}

const game = new MyGame()
game.start()
game.scheduler.run()
