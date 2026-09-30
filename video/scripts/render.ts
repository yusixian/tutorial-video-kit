/**
 * Renders episodes with one bundle and one browser: `pnpm render [ep1 …] [--concurrency 4]` →
 * `../out/raw/<ep>.mp4`, every episode when none is named. `--covers` renders the cover stills
 * instead: `../out/covers/<ep>-<ratio>.png`, plus `all-<ratio>.png` for the compilation.
 * Then `pnpm finalize` makes the upload files.
 */
import fs from 'node:fs'
import path from 'node:path'
import { bundle } from '@remotion/bundler'
import { getCompositions, openBrowser, renderMedia, renderStill, selectComposition } from '@remotion/renderer'
import { timeEpisode } from '../src/lib/timeline'
import { episodes } from '../src/script/episodes'
import { TRACKS } from '../src/script/music'
import { webpackOverride } from '../webpack-override'

const ROOT = path.resolve(import.meta.dirname, '..')
const PUBLIC = path.join(ROOT, 'public')
const OUT = path.resolve(ROOT, '../out')

const args = process.argv.slice(2)
const flag = (name: string) => {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}
const concurrency = Number(flag('--concurrency') ?? 4)
const covers = args.includes('--covers')
const named = args.filter((arg, i) => !arg.startsWith('--') && args[i - 1] !== '--concurrency')

/** Fail before bundling when a file the compositions load is missing, instead of mid-render. */
const checkAssets = (picked: typeof episodes) => {
  const needed = new Map<string, string>()
  let lines = 0
  let silent = 0
  for (const episode of picked) {
    for (const scene of timeEpisode(episode).scenes)
      for (const line of scene.lines) {
        lines++
        if (line.audio) needed.set(line.audio, 'run `pnpm tts` to restore the narration')
        else silent++
      }
    for (const { track } of episode.music ?? []) needed.set(TRACKS[track].file, 'run `pnpm sfx`, or add the track file')
  }
  for (const name of ['click', 'pop', 'whoosh', 'chime']) needed.set(`audio/sfx/${name}.wav`, 'run `pnpm sfx`')
  const missing = [...needed].filter(([file]) => !fs.existsSync(path.join(PUBLIC, file)))
  if (missing.length) throw new Error(`missing files in public/:\n${missing.map(([file, fix]) => `  ${file} (${fix})`).join('\n')}`)
  if (silent) console.warn(`${silent} of ${lines} lines have no narration yet; they render silent and are timed by reading speed. Run \`pnpm tts\` first for a voiced render.`)
}

const logProgress = (name: string) => {
  let last = -1
  return ({ progress }: { progress: number }) => {
    const value = Math.floor(progress * 10) * 10
    if (value !== last) console.log(`${new Date().toLocaleTimeString()} ${name}: ${value}%`)
    last = value
  }
}

async function main() {
  const unknown = named.filter(id => !(covers && id === 'all') && !episodes.some(e => e.id === id))
  if (unknown.length) throw new Error(`unknown episodes: ${unknown.join(', ')}`)
  if (!Number.isInteger(concurrency) || concurrency < 1) throw new Error('--concurrency takes a positive integer')
  const picked = episodes.filter(e => !named.length || named.includes(e.id))
  if (!covers) checkAssets(picked)

  console.log('bundling…')
  const serveUrl = await bundle({ entryPoint: path.join(ROOT, 'src/index.ts'), webpackOverride, publicDir: PUBLIC })
  const browser = await openBrowser('chrome')
  try {
    if (covers) {
      const wanted = new Set([...picked.map(e => e.id.toUpperCase()), ...(!named.length || named.includes('all') ? ['ALL'] : [])])
      const stills = (await getCompositions(serveUrl, { puppeteerInstance: browser })).filter(c => wanted.has(c.id.split('-')[1] ?? ''))
      fs.mkdirSync(path.join(OUT, 'covers'), { recursive: true })
      for (const composition of stills) {
        const [, episode, ratio] = composition.id.split('-')
        const output = path.join(OUT, 'covers', `${episode.toLowerCase()}-${ratio}.png`)
        await renderStill({ serveUrl, composition, frame: 0, output, puppeteerInstance: browser })
        console.log(output)
      }
      return
    }
    fs.mkdirSync(path.join(OUT, 'raw'), { recursive: true })
    for (const episode of picked) {
      const composition = await selectComposition({ serveUrl, id: episode.id.toUpperCase(), puppeteerInstance: browser })
      const outputLocation = path.join(OUT, 'raw', `${episode.id}.mp4`)
      await renderMedia({
        serveUrl,
        composition,
        outputLocation,
        puppeteerInstance: browser,
        codec: 'h264',
        crf: 18,
        imageFormat: 'png',
        pixelFormat: 'yuv420p',
        colorSpace: 'bt709',
        audioBitrate: '320k',
        enforceAudioTrack: true,
        concurrency,
        timeoutInMilliseconds: 120_000,
        onProgress: logProgress(episode.id),
      })
      console.log(outputLocation)
    }
  } finally {
    await browser.close({ silent: true })
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
