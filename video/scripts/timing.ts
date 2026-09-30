/**
 * Prints the voiced timeline: `pnpm timing [ep1 …]` lists each scene's start and length and each
 * line's frames, marking lines still timed by the reading-speed estimate (run `pnpm tts` to voice them).
 */
import { FPS, timeEpisode } from '../src/lib/timeline'
import { episodes } from '../src/script/episodes'

const only = process.argv.slice(2)
const unknown = only.filter(id => !episodes.some(e => e.id === id))
if (unknown.length) throw new Error(`unknown episodes: ${unknown.join(', ')}; the series has ${episodes.map(e => e.id).join(', ')}`)

const fmt = (frames: number) => `${Math.floor(frames / FPS / 60)}:${String(Math.floor((frames / FPS) % 60)).padStart(2, '0')}`
const preview = (text: string) => ([...text].length > 28 ? `${[...text].slice(0, 28).join('')}…` : text)

let estimated = 0
for (const episode of episodes.filter(e => !only.length || only.includes(e.id))) {
  const timing = timeEpisode(episode)
  console.log(`${episode.id} total ${fmt(timing.duration)} (${timing.duration}f)`)
  for (const s of timing.scenes) {
    console.log(`  ${s.scene.id.padEnd(18)} ${s.scene.section.padEnd(5)} ${fmt(s.from)} +${(s.duration / FPS).toFixed(1)}s`)
    for (const l of s.lines) {
      if (!l.audio) estimated++
      console.log(`    ${l.id.padEnd(18)} ${fmt(s.from + l.from)} L=${String(l.from).padEnd(5)} dur=${String(l.duration).padEnd(4)} ${l.audio ? ' ' : '~'} ${preview(l.text)}`)
    }
  }
  console.log('')
}
if (estimated) console.log(`~ ${estimated} lines have no voiced clip yet and are timed by a reading-speed estimate; run \`pnpm tts\`.`)
