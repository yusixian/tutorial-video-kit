/**
 * Writes the Bilibili upload kit for every episode and the compilation: `pnpm publish-kit` →
 * `../publish/<ep>.md` and `../publish/compilation.md`, each with title, description, pinned-comment
 * chapters, tags and music credits. Chapters come from the voiced timing, so rerun after any
 * script change or `pnpm tts`. Upload metadata and links live in `kits.ts`.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { config } from '../src/config'
import { chapters, clock, compilationChapters } from '../src/lib/chapters'
import { timeEpisode } from '../src/lib/timeline'
import { episodes, episodeTag } from '../src/script/episodes'
import { type TrackId, TRACKS } from '../src/script/music'
import { COMPILATION, type Kit, KITS, LINKS } from './kits'

const OUT = path.resolve(import.meta.dirname, '../../publish')
const DESCRIPTION_LIMIT = 2000
const PINNED_LIMIT = 1000
const PINNED_TAIL = ['', '资料下载和交流群的链接都在简介里']

const description = (kit: Kit, tracks: TrackId[]) => [
  `感谢观看${config.series}！章节目录在置顶评论，点时间就能跳到对应位置。`,
  kit.intro,
  `本系列按 ${config.version} 的界面录制；你看到的界面如果不一样，以你看到的为准。`,
  '',
  `【资料下载】${LINKS.materials}`,
  '',
  '【相关链接】',
  ...(kit.docs ?? LINKS.docs).map(([name, url]) => `${name}：${url}`),
  '',
  `【交流群】${LINKS.community}`,
  ...(tracks.length ? ['', '【BGM】', ...tracks.flatMap(track => TRACKS[track].credit)] : []),
  ...(kit.source ? ['', '【素材】', kit.source] : []),
]

/** The length note for the kit; also warns on the console when Bilibili would cut the text. */
const measured = (label: string, lines: string[], limit: number) => {
  const length = lines.join('\n').length
  if (length > limit) console.warn(`${label} is ${length} characters; Bilibili allows ${limit}`)
  return `> ${length} 字（B 站上限 ${limit} 字）`
}

const placeholders = [LINKS.materials, LINKS.community, ...LINKS.docs.map(([, url]) => url), ...Object.values(KITS).flatMap(k => (k.docs ?? []).map(([, url]) => url))].filter(url => /example\.com/.test(url))

const kitMarkdown = ({ heading, note, kit, pinned, tracks, covers }: { heading: string; note: string; kit: Kit; pinned: string[]; tracks: TrackId[]; covers: string }) => {
  const desc = description(kit, tracks)
  return [
    `# ${heading} · B 站投稿素材`,
    '',
    `> ${note}`,
    '',
    '## 发布前检查',
    '',
    `- [ ] ${placeholders.length ? `把 \`video/scripts/kits.ts\` 里的示例链接换成自己的（还有 ${placeholders.length} 个 example.com）` : '简介里的链接都能打开'}`,
    `- [ ] 封面：${covers}（\`pnpm covers\` 生成）`,
    '',
    '## 标题',
    '',
    kit.title,
    '',
    '## 简介',
    '',
    measured(`${heading} description`, desc, DESCRIPTION_LIMIT),
    '',
    '```text',
    ...desc,
    '```',
    '',
    '## 置顶评论',
    '',
    `${measured(`${heading} pinned comment`, pinned, PINNED_LIMIT)}；同样的时间码也可以填进投稿页的分段章节。`,
    '',
    '```text',
    ...pinned,
    '```',
    '',
    '## 标签',
    '',
    kit.tags.join('，'),
    '',
  ].join('\n')
}

async function main() {
  await fs.mkdir(OUT, { recursive: true })
  if (placeholders.length) console.warn(`kits.ts still has ${placeholders.length} example.com links; replace them before uploading`)
  for (const episode of episodes) {
    const kit = KITS[episode.id]
    if (!kit) throw new Error(`no upload kit for ${episode.id} in scripts/kits.ts`)
    const file = path.join(OUT, `${episode.id}.md`)
    const markdown = kitMarkdown({
      heading: `${episodeTag(episode)} ${episode.title}`,
      note: `由 \`video/scripts/publish.ts\` 生成，时长 ${clock(timeEpisode(episode).duration)}；视频文件 \`out/${episode.id}.mp4\`。改脚本后重新运行 \`pnpm publish-kit\`。`,
      kit,
      pinned: [...chapters(episode), ...PINNED_TAIL],
      tracks: [...new Set((episode.music ?? []).map(m => m.track))],
      covers: `\`out/covers/${episode.id}-16x9.png\`、\`out/covers/${episode.id}-4x3.png\``,
    })
    await fs.writeFile(file, markdown)
    console.log(file)
  }
  const total = episodes.reduce((sum, e) => sum + timeEpisode(e).duration, 0)
  const file = path.join(OUT, 'compilation.md')
  const markdown = kitMarkdown({
    heading: `全 ${episodes.length} 集合集`,
    note: `由 \`video/scripts/publish.ts\` 生成，时长 ${clock(total)}；视频文件 \`out/compilation.mp4\`（\`pnpm compilation\`）。`,
    kit: COMPILATION,
    pinned: [...compilationChapters(), ...PINNED_TAIL],
    tracks: [...new Set(episodes.flatMap(e => (e.music ?? []).map(m => m.track)))],
    covers: '`out/covers/all-16x9.png`、`out/covers/all-4x3.png`',
  })
  await fs.writeFile(file, markdown)
  console.log(file)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
