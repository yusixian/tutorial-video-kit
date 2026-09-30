import assert from 'node:assert/strict'
import test from 'node:test'
import type { EpisodeScript } from '../script/types'
import { timeEpisodeWithNarration } from './timeline'

const script: EpisodeScript = {
  id: 'test',
  number: 0,
  title: '测试',
  subtitle: '',
  sections: { '0-1': '小节' },
  scenes: [
    { id: 'test-title', section: '0-0', title: '标题', lead: 0, minSeconds: 3, lines: [] },
    {
      id: 'test-scene',
      section: '0-1',
      title: '场景',
      lines: [
        { id: 'test-01', text: '这一句还没有配音，时长按阅读速度估算。' },
        { id: 'test-02', text: '这一句有配音。', pause: 1 },
      ],
    },
  ],
}

test('a line without a clip is timed by reading speed; a clip sets the exact length', () => {
  const timing = timeEpisodeWithNarration(script, { 'test-02': { file: 'audio/tts/x.mp3', seconds: 2 } })
  const [title, scene] = timing.scenes
  assert.equal(title.duration, 90)
  assert.equal(scene.from, 90)
  const [estimated, voiced] = scene.lines
  assert.equal(estimated.audio, undefined)
  assert.equal(estimated.from, 12)
  assert.equal(estimated.duration, Math.round((estimated.text.length / 5.2) * 30))
  assert.equal(voiced.from, estimated.from + estimated.duration + Math.round(0.28 * 30))
  assert.equal(voiced.duration, 60)
  assert.equal(voiced.audio, 'audio/tts/x.mp3')
  assert.equal(scene.duration, voiced.from + 60 + 30 + 18)
  assert.equal(timing.duration, 90 + scene.duration)
})
