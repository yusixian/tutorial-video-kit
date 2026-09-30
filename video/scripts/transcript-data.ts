/**
 * The transcript model shared by `transcript.ts` (local Markdown + stills), `transcript-lark.ts`
 * (the Lark doc) and `prompter.ts`: every voiced line with its episode and compilation time,
 * grouped by scene, each scene tied to the component file that draws it.
 */
import fs from 'node:fs'
import path from 'node:path'
import { FPS, timeEpisode } from '../src/lib/timeline'
import { episodes, episodeTag } from '../src/script/episodes'

export const VIDEO = path.resolve(import.meta.dirname, '..')
export const ROOT = path.resolve(VIDEO, '..')
export const OUT = path.join(ROOT, 'transcript')

export type TranscriptLine = { n: number; id: string; at: number; duration: number; text: string; tts?: string }
export type TranscriptScene = {
  index: number
  id: string
  title: string
  section: string
  sectionTitle: string
  from: number
  to: number
  component: string
  file: string
  lines: TranscriptLine[]
}
export type TranscriptEpisode = { id: string; tag: string; title: string; duration: number; offset: number; scenes: TranscriptScene[] }

export const stamp = (frame: number) => {
  const s = Math.floor(frame / FPS)
  const mmss = `${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  return s >= 3600 ? `${Math.floor(s / 3600)}:${mmss}` : mmss
}

/** Circled scene numbers, so a note can say "EP1 ④" and mean one scene. */
export const circled = (n: number) => (n <= 20 ? String.fromCodePoint(0x2460 + n - 1) : `(${n})`)

/** Scene id → component name and file, read from the episode's scene registry (`src/scenes/<ep>/index.ts`) and its imports. */
const componentFiles = (episodeId: string) => {
  const dir = path.join(VIDEO, 'src/scenes', episodeId)
  const registry = path.join(dir, 'index.ts')
  const map = new Map<string, { component: string; file: string }>()
  if (!fs.existsSync(registry)) return map
  const source = fs.readFileSync(registry, 'utf8')
  const imported = new Map<string, string>()
  for (const [, names, from] of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]\.\/([\w-]+)['"]/g))
    for (const name of names.split(',').map(n => n.trim().replace(/^type\s+/, '')).filter(Boolean)) imported.set(name, `${from}.tsx`)
  for (const [, scene, component] of source.matchAll(/['"]([\w-]+)['"]:\s*\{[^}]*?\bcomponent:\s*(\w+)/g))
    map.set(scene, { component, file: path.relative(ROOT, path.join(dir, imported.get(component) ?? path.basename(registry))) })
  return map
}

export const transcript = (): TranscriptEpisode[] => {
  let offset = 0
  return episodes.map(episode => {
    const timing = timeEpisode(episode)
    const files = componentFiles(episode.id)
    let n = 0
    const scenes = timing.scenes.map((s, i) => ({
      index: i + 1,
      id: s.scene.id,
      title: s.scene.title,
      section: s.scene.section,
      sectionTitle: episode.sections[s.scene.section] ?? s.scene.title,
      from: s.from,
      to: s.from + s.duration,
      component: files.get(s.scene.id)?.component ?? '?',
      file: files.get(s.scene.id)?.file ?? '?',
      lines: s.lines.map(l => ({ n: ++n, id: l.id, at: s.from + l.from, duration: l.duration, text: l.text, tts: l.tts })),
    }))
    const result = { id: episode.id, tag: episodeTag(episode), title: episode.title, duration: timing.duration, offset, scenes }
    offset += timing.duration
    return result
  })
}

/** Where a line's still is taken: late enough in the line for its cues to have landed. */
export const stillFrame = (line: TranscriptLine) => line.at + Math.round(line.duration * 0.8)

export const stillPath = (episode: TranscriptEpisode, scene: TranscriptScene) => path.join(OUT, episode.id, `${String(scene.index).padStart(2, '0')}-${scene.id}.jpg`)

/** Where to edit what and how to ask for changes; heads both the local README and the Lark transcript. */
export const HOW_TO = [
  '在哪里改：',
  '- 口播和字幕：`video/src/script/epN.ts`，每句一个 id；`text` 是字幕，`tts` 是配音的读法（数字、英文念法和字幕不同的句子才有）。',
  '- 画面：`video/src/scenes/epN/` 下的组件，每个场景都标了负责它的组件文件。',
  '- 时间码：由配音时长自动推算，改字、重新配音后会变；`pnpm timing epN` 可以随时查看。',
  '',
  '怎么提修改：说「EP1 #12 改成……」「EP1 ④ 的画面……」或直接给句子 id 都行；也可以在飞书版逐字稿里直接改字、加评论，再运行 `pnpm transcript:lark pull` 同步。',
]
