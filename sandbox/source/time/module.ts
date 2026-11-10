import {
  Channel,
  ChannelPriority,
  NodeChannel,
  type ScenesModule,
  TimeModule,
  type Updatable,
} from '@dotm4x/fable'

export class MyTimeModule extends TimeModule {
  public main: Channel
  public scenes: NodeChannel

  public constructor(game: Updatable, scenes: ScenesModule) {
    super()
    this.main = new Channel({
      identifier: 'main',
      targetUpdateRate: 60,
      priority: ChannelPriority.normal,
      entries: [game],
    })
    this.scenes = new NodeChannel({
      identifier: 'scenes',
      manager: scenes,
      targetUpdateRate: 60,
      priority: ChannelPriority.normal,
    })
  }

  protected override *compose(): Generator<Channel> {
    yield this.main
    yield this.scenes
  }
}
