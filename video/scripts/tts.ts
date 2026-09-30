/**
 * Voices every narration line with Edge TTS and records word boundaries from the same stream: `pnpm tts`.
 *
 * Clips are cached by text, voice, rate, pitch and timing-format version, so reruns only
 * synthesize lines that changed. Output: `public/audio/tts/<hash>.mp3` plus `.words.jsonl`
 * metadata and `src/script/tts-manifest.json` ({ [lineId]: { file, seconds, speech } }) in script order.
 * Needs `uv` (for `uvx`) and `ffprobe` on PATH.
 */
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { config } from '../src/config'
import type { SpeechTiming } from '../src/lib/captions'
import { episodes } from '../src/script/episodes'
import { VOICE } from '../src/script/voice'
import { spokenText } from './spoken-text'

const run = promisify(execFile)
const ROOT = path.resolve(import.meta.dirname, '..')
const AUDIO_DIR = 'audio/tts'
const OUT_DIR = path.join(ROOT, 'public', AUDIO_DIR)
const MANIFEST = path.join(ROOT, 'src/script/tts-manifest.json')
const EDGE_TTS = 'edge-tts>=7.2,<8'
const WORKERS = 4

type Entry = { file: string; seconds: number; speech: SpeechTiming }

async function probeSeconds(file: string) {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file])
  return Number(stdout.trim())
}

async function readSpeech(text: string, metadata: string): Promise<SpeechTiming> {
  const records = (await fs.readFile(metadata, 'utf8'))
    .trim()
    .split('\n')
    .map(line => JSON.parse(line) as { type: string; offset: number; duration: number; text: string })
  const words = records.filter(word => word.type === 'WordBoundary').map(word => ({ text: word.text, from: word.offset / 10_000_000, to: (word.offset + word.duration) / 10_000_000 }))
  const normalize = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
  if (!words.length || normalize(words.map(w => w.text).join('')) !== normalize(text)) throw new Error(`word boundaries do not spell the narration: ${metadata}`)
  if (words.some((w, i) => w.from < 0 || w.to <= w.from || (i > 0 && w.from < words[i - 1].from))) throw new Error(`invalid word timing: ${metadata}`)
  return { text, words }
}

async function voiceLine(text: string): Promise<Entry> {
  const hash = createHash('sha1').update(JSON.stringify([text, VOICE.name, VOICE.rate, VOICE.pitch, 'word-boundary-v1'])).digest('hex').slice(0, 16)
  const file = `${AUDIO_DIR}/${hash}.mp3`
  const abs = path.join(ROOT, 'public', file)
  const metadata = abs.replace(/\.mp3$/, '.words.jsonl')
  const cached = await Promise.all([abs, metadata].map(p => fs.access(p).then(() => true, () => false))).then(found => found.every(Boolean))
  if (!cached) {
    for (let attempt = 1; ; attempt++) {
      try {
        await run('uvx', ['--from', EDGE_TTS, 'python', path.join(ROOT, 'scripts/voice-line.py'), text, VOICE.name, VOICE.rate, VOICE.pitch, `${abs}.partial.mp3`, `${metadata}.partial`])
        await readSpeech(text, `${metadata}.partial`)
        await fs.rename(`${abs}.partial.mp3`, abs)
        await fs.rename(`${metadata}.partial`, metadata)
        break
      } catch (err) {
        if (attempt >= 3) throw err
        await new Promise(r => setTimeout(r, 1500 * attempt))
      }
    }
  }
  const seconds = await probeSeconds(abs)
  const speech = await readSpeech(text, metadata)
  if (speech.words.at(-1)!.to > seconds + 0.2) throw new Error(`word boundaries exceed audio: ${file}`)
  return { file, seconds, speech }
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true })
  const lines = episodes.flatMap(ep => ep.scenes.flatMap(s => s.lines))
  const ids = new Set<string>()
  for (const line of lines) {
    if (ids.has(line.id)) throw new Error(`duplicate line id ${line.id}`)
    ids.add(line.id)
  }
  const manifest: Record<string, Entry> = {}
  let next = 0
  await Promise.all(
    Array.from({ length: WORKERS }, async () => {
      while (next < lines.length) {
        const line = lines[next++]
        const said = line.tts ?? line.text
        manifest[line.id] = await voiceLine(config.locale === 'zh' ? spokenText(said) : said)
        console.log(`${line.id}: ${manifest[line.id].seconds.toFixed(2)}s, ${manifest[line.id].speech.words.length} word timestamps`)
      }
    }),
  )
  const ordered = Object.fromEntries(lines.map(l => [l.id, manifest[l.id]]))
  await fs.writeFile(MANIFEST, `${JSON.stringify(ordered, null, 1)}\n`)
  const total = Object.values(ordered).reduce((sum, e) => sum + e.seconds, 0)
  console.log(`\n${lines.length} lines, ${(total / 60).toFixed(1)} min of narration → ${path.relative(ROOT, MANIFEST)}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
