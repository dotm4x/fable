import { describe, expect, it } from 'vitest'

import { SourceWatcher } from '../../../source/index.js'

describe('SourceWatcher', () => {
  it('notifies connected callbacks with the changed source', () => {
    const watcher = new SourceWatcher()
    const sources: string[] = []
    watcher.onChange.connect((source) => sources.push(source))

    watcher.notify('first.png')
    watcher.notify('second.png')

    expect(sources).toEqual(['first.png', 'second.png'])
    watcher.destroy()
  })

  it('rejects empty sources and notifications after destruction', () => {
    const watcher = new SourceWatcher()

    expect(() => {
      watcher.notify(' ')
    }).toThrow('must not be empty')

    watcher.destroy()

    expect(() => {
      watcher.notify('image.png')
    }).toThrow('destroyed')
  })
})
