import { Channel, ChannelPriority, TimeModule, type Updatable } from '@dotm4x/fable'

export class MyTimeModule extends TimeModule {
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
