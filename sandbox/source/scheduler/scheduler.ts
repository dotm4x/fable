import { Channel, ChannelPriority, Scheduler, type Updatable } from '@dotm4x/fable'

export class MyScheduler extends Scheduler {
  public main: Channel

  public constructor(game: Updatable) {
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
