import {
  Channel,
  ChannelPriority,
  Game,
  type Module,
  Node,
  SceneManager,
  Scheduler,
  type Updatable,
} from '@dotm4x/fable'

class MyScene extends Node {
  protected override onLoad(): void {
    console.log('scene start')
  }
}
class MySceneManager extends SceneManager {
  public main: MyScene

  public constructor() {
    super({ initial: new MyScene() })
    this.main = new MyScene()
  }
}

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
  public scenes: MySceneManager

  public constructor() {
    super()
    this.scheduler = new MyScheduler(this)
    this.scenes = new MySceneManager()
  }

  protected override *compose(): Generator<Module> {
    yield this.scheduler
    yield this.scenes
  }

  public update(): void {
    return
  }
}

const game = new MyGame()
game.start()
game.scheduler.run()
