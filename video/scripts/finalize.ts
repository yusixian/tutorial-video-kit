/**
 * Loudness-normalizes rendered episodes for upload: `pnpm finalize [ep1 …]` reads
 * `../out/raw/<ep>.mp4` and writes `../out/<ep>.mp4`, every episode when none is named.
 * Two-pass EBU R128 to -15 LUFS / -1 dBTP; the video stream is copied untouched and the
 * audio is cut to the exact video length.
 */
import { execFile } from 'node:child_process'
import { access } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { episodes } from '../src/script/episodes'

const run = promisify(execFile)
const OUT = path.resolve(import.meta.dirname, '../../out')
const TARGET = 'I=-15:TP=-1.0:LRA=11'

/** Exact picture length from the frame count, so the audio can be cut to the same instant. */
async function videoSeconds(file: string) {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=nb_frames,r_frame_rate', '-of', 'json', file])
  const video = (JSON.parse(stdout) as { streams: { nb_frames?: string; r_frame_rate?: string }[] }).streams[0]
  const [num, den] = (video?.r_frame_rate ?? '').split('/').map(Number)
  const frames = Number(video?.nb_frames)
  if (!(frames > 0 && num > 0 && den > 0)) throw new Error(`cannot determine video duration: ${file}`)
  return (frames * den) / num
}

async function measure(file: string) {
  const { stderr } = await run('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-map', '0:a', '-af', `loudnorm=${TARGET}:print_format=json`, '-f', 'null', '-'], { maxBuffer: 1 << 26 })
  const json = stderr.slice(stderr.lastIndexOf('{'), stderr.lastIndexOf('}') + 1)
  return JSON.parse(json) as Record<string, string>
}

const exists = (file: string) =>
  access(file)
    .then(() => true)
    .catch(() => false)

async function finalize(episode: string) {
  const input = path.join(OUT, 'raw', `${episode}.mp4`)
  if (!(await exists(input))) throw new Error(`render ${episode} first: ${input} is missing`)
  const output = path.join(OUT, `${episode}.mp4`)
  const duration = await videoSeconds(input)
  const m = await measure(input)
  const filter = `loudnorm=${TARGET}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`
  await run('ffmpeg', ['-hide_banner', '-y', '-i', input, '-map', '0:v', '-map', '0:a', '-c:v', 'copy', '-af', filter, '-ar', '48000', '-c:a', 'aac', '-b:a', '320k', '-t', String(duration), '-movflags', '+faststart', output])
  const after = await measure(output)
  console.log(`${episode}: ${m.input_i} LUFS / ${m.input_tp} dBTP → ${after.input_i} LUFS / ${after.input_tp} dBTP`)
}

async function main() {
  const named = process.argv.slice(2)
  const unknown = named.filter(id => !episodes.some(e => e.id === id))
  if (unknown.length) throw new Error(`unknown episodes: ${unknown.join(', ')}`)
  for (const episode of named.length ? named : episodes.map(e => e.id)) await finalize(episode)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
