/**
 * Writes the timestamped transcript: `pnpm transcript [ep1 …] [--no-stills]` → `../transcript/README.md`
 * and `../transcript/<ep>.md`, with one still per line cut from the finished `../out/<ep>.mp4`
 * (render and finalize first) and tiled per scene. Lines are numbered per episode and keep their
 * script ids, so "EP1 #12" or `ep1-panel-02` points straight at `src/script/<ep>.ts`; scenes carry
 * circled numbers and the component that draws them. Needs ffmpeg and ImageMagick (`magick`).
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { config } from '../src/config'
import { FPS } from '../src/lib/timeline'
import { circled, HOW_TO, OUT, ROOT, stamp, stillFrame, stillPath, type TranscriptEpisode, type TranscriptScene, transcript } from './transcript-data'

const THUMB_W = 480
const COLUMNS = 4

/** Every still an episode needs: one per line, or the scene's middle when it has no lines. */
const stills = (scene: TranscriptScene) =>
  scene.lines.length ? scene.lines.map(line => ({ frame: stillFrame(line), label: `#${line.n}  ${stamp(line.at)}` })) : [{ frame: Math.round((scene.from + scene.to) / 2), label: stamp(scene.from) }]

/** Cuts all of an episode's stills in one decoding pass, then tiles each scene's into a strip. */
const renderStills = (episode: TranscriptEpisode) => {
  const video = path.join(ROOT, 'out', `${episode.id}.mp4`)
  if (!fs.existsSync(video)) throw new Error(`render and finalize ${episode.id} first: ${video} is missing (or pass --no-stills)`)
  const wanted = episode.scenes.flatMap(stills)
  const frames = [...new Set(wanted.map(s => s.frame))].sort((a, b) => a - b)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `transcript-${episode.id}-`))
  const select = frames.map(f => `eq(n\\,${f})`).join('+')
  execFileSync('ffmpeg', ['-v', 'error', '-i', video, '-vf', `select='${select}',scale=${THUMB_W}:-2`, '-fps_mode', 'vfr', '-q:v', '3', path.join(tmp, '%04d.jpg')])
  const fileOf = new Map(frames.map((f, i) => [f, path.join(tmp, `${String(i + 1).padStart(4, '0')}.jpg`)]))
  fs.mkdirSync(path.join(OUT, episode.id), { recursive: true })
  for (const scene of episode.scenes) {
    const items = stills(scene)
    const args = items.flatMap(s => ['-label', s.label, fileOf.get(s.frame) ?? ''])
    execFileSync('magick', ['montage', ...args, '-tile', `${Math.min(COLUMNS, items.length)}x`, '-geometry', `${THUMB_W}x+6+6`, '-background', '#15171c', '-fill', '#f3f4f7', '-pointsize', '20', '-quality', '82', stillPath(episode, scene)])
  }
  fs.rmSync(tmp, { recursive: true, force: true })
}

const sceneMarkdown = (episode: TranscriptEpisode, scene: TranscriptScene, withStills: boolean) => [
  `## ${circled(scene.index)} ${scene.title} · ${stamp(scene.from)}–${stamp(scene.to)}`,
  '',
  `画面：\`${scene.file}\` › \`${scene.component}\` · 场景 \`${scene.id}\` · 小节 ${scene.section} ${scene.sectionTitle}`,
  '',
  ...(withStills ? [`![${scene.title}](${path.relative(OUT, stillPath(episode, scene))})`, ''] : []),
  ...(scene.lines.length ? scene.lines.flatMap(line => [`- **#${line.n}** \`${stamp(line.at)}\` ${line.text} · \`${line.id}\``, ...(line.tts ? [`  - 配音读作：${line.tts}`] : [])]) : ['- （无口播）']),
  '',
]

const episodeMarkdown = (episode: TranscriptEpisode, withStills: boolean) => [
  `# ${episode.tag} ${episode.title}`,
  '',
  `时长 ${stamp(episode.duration)} · 合集里从 ${stamp(episode.offset)} 开始 · 逐字稿源文件 \`video/src/script/${episode.id}.ts\` · 视频 \`out/${episode.id}.mp4\``,
  '',
  ...episode.scenes.flatMap(scene => sceneMarkdown(episode, scene, withStills)),
]

const readme = (list: TranscriptEpisode[]) => [
  `# ${config.series} · 逐字稿`,
  '',
  `> 由 \`video/scripts/transcript.ts\` 生成（${new Date().toISOString().slice(0, 10)}），改脚本或重新渲染后运行 \`pnpm transcript\` 刷新。`,
  '',
  ...HOW_TO,
  '',
  '| 集 | 时长 | 合集起点 | 句数 | 文件 |',
  '| --- | --- | --- | --- | --- |',
  ...list.map(e => `| ${e.tag} ${e.title} | ${stamp(e.duration)} | ${stamp(e.offset)} | ${e.scenes.reduce((n, s) => n + s.lines.length, 0)} | [${e.id}.md](${e.id}.md) |`),
  '',
  `合集总长 ${stamp(list.reduce((sum, e) => sum + e.duration, 0))}，${FPS} fps。`,
  '',
]

async function main() {
  const only = process.argv.slice(2).filter(a => !a.startsWith('-'))
  const withStills = !process.argv.includes('--no-stills')
  const list = transcript()
  fs.mkdirSync(OUT, { recursive: true })
  for (const episode of list) {
    if (only.length && !only.includes(episode.id)) continue
    if (withStills) renderStills(episode)
    const file = path.join(OUT, `${episode.id}.md`)
    fs.writeFileSync(file, episodeMarkdown(episode, withStills).join('\n'))
    console.log(file)
  }
  fs.writeFileSync(path.join(OUT, 'README.md'), readme(list).join('\n'))
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
