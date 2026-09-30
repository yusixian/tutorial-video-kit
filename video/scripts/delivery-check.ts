/**
 * Checks the finished files against the voiced timeline before upload: `pnpm delivery-check`.
 *
 * Always: unique line ids, narration inside its scene, no overlapping lines, and every subtitle
 * chunk of a voiced line on screen for at least 1.2 s. Full run: every line has its narration
 * clip and word boundaries, and each `../out/<ep>.mp4` (plus `compilation.mp4` when present) has
 * the timeline's frame count, 1920×1080, 30 fps, h264 yuv420p BT.709, AAC 48 kHz, audio within a
 * frame of the video, and decodes end to end. `--timing-only` skips everything that needs files,
 * so it passes before `pnpm tts` has run. Writes `../out/validation.json` (or `timeline-validation.json`).
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { config } from '../src/config'
import { chunkCue } from '../src/lib/captions'
import { FPS, timeEpisode } from '../src/lib/timeline'
import { episodes } from '../src/script/episodes'

const ROOT = path.resolve(import.meta.dirname, '..')
const args = process.argv.slice(2)
const dirIndex = args.indexOf('--dir')
const dir = path.resolve(dirIndex >= 0 ? args[dirIndex + 1] : path.join(ROOT, '../out'))
const timingOnly = args.includes('--timing-only')
const MIN_CHUNK = 1.2 * FPS

const timings = episodes.map(timeEpisode)
const lines = timings.flatMap(t => t.scenes.flatMap(s => s.lines))
const duplicate = lines.find((line, i) => lines.findIndex(l => l.id === line.id) !== i)
assert.ok(!duplicate, `Duplicate line id: ${duplicate?.id}`)
for (const timing of timings) {
  for (const scene of timing.scenes) {
    for (const [index, line] of scene.lines.entries()) {
      assert.ok(line.from + line.duration <= scene.duration, `Narration exceeds scene: ${line.id}`)
      const next = scene.lines[index + 1]
      assert.ok(!next || next.from >= line.from + line.duration, `Overlapping narration: ${line.id}`)
    }
  }
}
const voiced = lines.filter(line => line.audio)
const subtitles = voiced.flatMap(line => chunkCue({ from: line.from, duration: line.duration, text: line.text, speech: line.speech, em: line.em }, FPS, config.locale).map(cue => ({ ...cue, id: line.id })))
const brief = subtitles.find(cue => cue.duration < MIN_CHUNK)
assert.ok(!brief, `Subtitle chunk shorter than 1.2 s in ${brief?.id}: 「${brief?.text}」`)

if (!timingOnly) {
  for (const line of lines) {
    assert.ok(line.audio && fs.existsSync(path.join(ROOT, 'public', line.audio)), `Missing narration: ${line.id} (run \`pnpm tts\`)`)
    assert.ok(line.speech?.words.length, `Missing word boundaries: ${line.id}`)
    assert.ok(line.speech.words.at(-1)!.to <= line.duration / FPS + 0.2, `Word boundaries exceed clip: ${line.id}`)
  }
}

let offset = 0
const timeline = timings.map(t => {
  const result = { id: t.episode.id, offset, frames: t.duration, scenes: t.scenes.map(s => ({ id: s.scene.id, from: s.from, frames: s.duration, lines: s.lines.map(l => ({ id: l.id, from: l.from, frames: l.duration, text: l.text })) })) }
  offset += t.duration
  return result
})

type Stream = { codec_type: string; codec_name: string; nb_frames: string; width: number; height: number; r_frame_rate: string; pix_fmt: string; color_space?: string; sample_rate: string; duration: string }

const media = []
const compilation = path.join(dir, 'compilation.mp4')
const targets = timingOnly ? [] : [...timeline, ...(fs.existsSync(compilation) ? [{ id: 'compilation', frames: offset }] : [])]
for (const target of targets) {
  const file = path.join(dir, `${target.id}.mp4`)
  assert.ok(fs.existsSync(file), `Missing ${file} (render and finalize it first)`)
  const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file], { encoding: 'utf8' })) as { streams: Stream[] }
  const video = probe.streams.find(s => s.codec_type === 'video')
  const audio = probe.streams.find(s => s.codec_type === 'audio')
  assert.ok(video && audio, `${target.id}: needs one video and one audio stream`)
  assert.equal(Number(video.nb_frames), target.frames, `${target.id}: stale or incomplete video`)
  assert.equal(video.width, 1920, `${target.id}: width`)
  assert.equal(video.height, 1080, `${target.id}: height`)
  assert.equal(video.r_frame_rate, `${FPS}/1`, `${target.id}: frame rate`)
  assert.equal(video.codec_name, 'h264', `${target.id}: video codec`)
  assert.equal(video.pix_fmt, 'yuv420p', `${target.id}: pixel format`)
  assert.equal(video.color_space, 'bt709', `${target.id}: color space`)
  assert.equal(audio.codec_name, 'aac', `${target.id}: audio codec`)
  assert.equal(audio.sample_rate, '48000', `${target.id}: sample rate`)
  const drift = Math.abs(Number(video.duration) - Number(audio.duration))
  assert.ok(drift < 1 / FPS, `${target.id}: audio/video duration drift ${drift.toFixed(3)} s`)
  execFileSync('ffmpeg', ['-v', 'error', '-xerror', '-i', file, '-f', 'null', '-'], { stdio: ['ignore', 'ignore', 'pipe'] })
  media.push({ id: target.id, frames: Number(video.nb_frames), seconds: Number(video.duration), audioSeconds: Number(audio.duration), driftSeconds: drift, fullDecode: true })
  console.log(`validated: ${target.id} ${video.nb_frames} frames, drift ${(drift * 1000).toFixed(1)} ms`)
}

fs.mkdirSync(dir, { recursive: true })
const report = path.join(dir, timingOnly ? 'timeline-validation.json' : 'validation.json')
fs.writeFileSync(
  report,
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      narrationLines: lines.length,
      voicedLines: voiced.length,
      wordBoundaries: voiced.reduce((sum, l) => sum + (l.speech?.words.length ?? 0), 0),
      subtitleChunks: subtitles.length,
      minimumSubtitleFrames: subtitles.length ? Math.min(...subtitles.map(c => c.duration)) : null,
      timeline,
      media,
    },
    null,
    2,
  ),
)
console.log(`${timingOnly ? 'Timeline valid' : `Validated ${media.length} files`}: ${lines.length} lines (${voiced.length} voiced), ${subtitles.length} subtitle chunks checked → ${path.relative(process.cwd(), report)}`)
