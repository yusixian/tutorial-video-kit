/**
 * Joins the finalized episodes in series order: `pnpm compilation [--reencode]` → `../out/compilation.mp4`.
 *
 * Video is stream-copied when every episode shares codec, size, frame rate and pixel format, as
 * `pnpm render` output does; otherwise (or with `--reencode`) it is re-encoded. Audio is always
 * decoded, cut or padded to each episode's exact picture length and encoded once: joining the AAC
 * streams as they are would add an encoder delay at every seam and drift off the picture. The concat
 * list holds video-only copies with explicit durations, so AAC priming never offsets the picture
 * and every episode starts on its exact frame.
 *
 * The project this kit came from also drew a series-wide progress bar on the compilation; it rendered
 * that bar as a separate strip and overlaid it on the joined video instead of re-rendering every frame.
 */
import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { episodes } from '../src/script/episodes'

const run = promisify(execFile)
const OUT = path.resolve(import.meta.dirname, '../../out')
const MATCH = ['codec_name', 'profile', 'width', 'height', 'r_frame_rate', 'pix_fmt', 'color_space', 'time_base'] as const

type VideoStream = Record<(typeof MATCH)[number], string | number> & { nb_frames: string }

async function probe(file: string) {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', `stream=${MATCH.join(',')},nb_frames`, '-of', 'json', file])
  const video = (JSON.parse(stdout) as { streams: VideoStream[] }).streams[0]
  if (!video) throw new Error(`no video stream: ${file}`)
  const [num, den] = String(video.r_frame_rate).split('/').map(Number)
  return { video, frames: Number(video.nb_frames), fps: num / den }
}

async function main() {
  const files = episodes.map(e => path.join(OUT, `${e.id}.mp4`))
  for (const file of files) await fs.access(file).catch(() => Promise.reject(new Error(`finalize every episode first: ${file} is missing`)))
  const probes = await Promise.all(files.map(probe))
  const mismatch = MATCH.filter(key => new Set(probes.map(p => p.video[key])).size > 1)
  const reencode = process.argv.includes('--reencode') || mismatch.length > 0
  if (mismatch.length) console.log(`episodes differ in ${mismatch.join(', ')}; re-encoding the video`)

  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'compilation-'))
  const list = path.join(tmp, 'list.txt')
  const pictures = await Promise.all(
    files.map(async (file, i) => {
      const copy = path.join(tmp, `${i}.mp4`)
      await run('ffmpeg', ['-hide_banner', '-v', 'error', '-i', file, '-map', '0:v', '-c', 'copy', copy])
      return copy
    }),
  )
  await fs.writeFile(list, pictures.map((file, i) => `file '${file.replace(/'/g, "'\\''")}'\nduration ${probes[i].frames / probes[i].fps}`).join('\n'))
  const audio = probes.map(({ frames, fps }, i) => `[${i + 1}:a]aresample=48000,asetpts=N/SR/TB,apad,atrim=end_sample=${Math.round((frames / fps) * 48000)}[a${i}]`)
  const joinAudio = `${probes.map((_, i) => `[a${i}]`).join('')}concat=n=${probes.length}:v=0:a=1[a]`
  const video = reencode
    ? [
        `${probes.map((_, i) => `[${i + 1}:v]fps=30,scale=1920:1080,setsar=1,format=yuv420p[v${i}]`).join(';')}`,
        `${probes.map((_, i) => `[v${i}]`).join('')}concat=n=${probes.length}:v=1:a=0[v]`,
      ]
    : []
  const output = path.join(OUT, 'compilation.mp4')
  const encodeVideo = reencode
    ? ['-map', '[v]', '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709']
    : ['-map', '0:v', '-c:v', 'copy']
  await run(
    'ffmpeg',
    [
      '-hide_banner', '-v', 'error', '-y',
      '-f', 'concat', '-safe', '0', '-i', list,
      ...files.flatMap(file => ['-i', file]),
      '-filter_complex', [...audio, joinAudio, ...video].join(';'),
      ...encodeVideo,
      '-map', '[a]', '-c:a', 'aac', '-b:a', '320k', '-ar', '48000',
      '-movflags', '+faststart', output,
    ],
    { maxBuffer: 1 << 26 },
  )
  await fs.rm(tmp, { recursive: true, force: true })
  const total = probes.reduce((sum, p) => sum + p.frames, 0)
  console.log(`${output}: ${episodes.length} episodes, ${total} frames (${reencode ? 're-encoded' : 'video stream-copied'})`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
