import assert from 'node:assert/strict'
import test from 'node:test'
import { chunkCue, cueTextFrame, type SpeechTiming } from './captions'

test('merges the half-second opening fragment without dropping the line ending', () => {
  const text = '说实话，我以前一直都在用 Excel 排字幕，但这次的新流程让我很想试一试。'
  const cues = chunkCue({ from: 353, duration: 270, text })
  assert.ok(cues.every(cue => cue.duration >= 36))
  assert.equal(cues[0].from, 353)
  assert.equal(cues.at(-1)!.from + cues.at(-1)!.duration, 623)
  const normalize = (value: string) => value.replace(/[，、,;；]/g, '')
  assert.equal(normalize(cues.map(cue => cue.text).join('')), normalize(text))
})

test('uses spoken word onset across a pause, including a numeric display override', () => {
  const first = '时长菜单里有 5 秒、10 秒和 15 秒；'
  const rest = '能选哪些，要看当前模型和参考模式。'
  const speech: SpeechTiming = {
    text: '时长菜单里有五秒、十秒和十五秒；' + rest,
    words: [
      { text: '时长菜单里有五秒十秒和十五秒', from: 0, to: 2.5 },
      { text: '能选哪些', from: 4.2, to: 5.2 },
      { text: '要看当前模型和参考模式', from: 5.4, to: 8 },
    ],
  }
  const cues = chunkCue({ from: 90, duration: 255, text: first + rest, speech })
  const next = cues.find(cue => cue.text.startsWith('能选'))
  assert.ok(next)
  assert.equal(next.from, 90 + 126)
  assert.equal(cueTextFrame({ from: 90, duration: 255, text: first + rest, speech }, '能选哪些'), 90 + 126)
  assert.ok(cues.every(cue => cue.duration >= 36))
})

test('keeps a quoted prompt intact and does not split at an English version decimal', () => {
  const quote = '「深夜书店，女孩子在看书，氛围好一点」'
  const cues = chunkCue({ from: 0, duration: 420, text: `像这样只丢一句${quote}，Engine 4.2 就会照着写，试试看。` })
  assert.ok(cues.some(cue => cue.text.includes(quote)))
  assert.ok(cues.some(cue => cue.text.includes('Engine 4.2')))
  assert.ok(cues.every(cue => cue.duration >= 36))
})

test('English captions keep whole words, version numbers, and synthesis timing', () => {
  const text = 'Engine 4.2 supports a detailed English prompt. Choose the subject and setting, then describe the light and mood.'
  const words = text.split(' ')
  const speech = { text, words: words.map((text, i) => ({ text, from: i * 0.4, to: i * 0.4 + 0.3 })) }
  const cues = chunkCue({ from: 60, duration: words.length * 12, text, speech }, 30, 'en')
  assert.equal(cues.map(c => c.text).join(' '), text)
  assert.ok(cues.every(c => c.text.length <= 68 && c.duration > 0))
  assert.ok(cues[0].text.includes('Engine 4.2'))
  assert.equal(cues.at(-1)!.from + cues.at(-1)!.duration, 60 + words.length * 12)
  assert.equal(cueTextFrame({ from: 60, duration: words.length * 12, text, speech }, 'Choose'), 60 + words.indexOf('Choose') * 12)
})

test('balances the last English caption instead of isolating a final word', () => {
  const text = "Let's take a quick tour of the panel, then write a prompt of our own."
  const cues = chunkCue({ from: 0, duration: 210, text }, 30, 'en')
  assert.equal(cues.map(c => c.text).join(' '), text)
  assert.ok(cues.every(c => c.text.length >= 20 && c.text.length <= 68))
  assert.equal(cues[0].text, "Let's take a quick tour of the panel,")
})

test('English captions break a settings list at punctuation and retain phrase timing', () => {
  const text = 'Settings brings together generation speed, image count, aspect ratio, and resolution.'
  const words = text.split(' ')
  const speech = { text, words: words.map((text, i) => ({ text, from: i * 0.4, to: i * 0.4 + 0.3 })) }
  const cues = chunkCue({ from: 30, duration: words.length * 12, text, speech }, 30, 'en')
  assert.equal(cues.map(c => c.text).join(' '), text)
  assert.ok(cues.some(c => c.text.includes('aspect ratio')))
  assert.equal(cues[0].text, 'Settings brings together generation speed, image count,')
  assert.equal(cues[1].from, 30 + words.indexOf('aspect') * 12)
})
