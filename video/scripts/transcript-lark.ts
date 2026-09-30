/**
 * The Lark (Feishu) copy of the transcript, for pointing at lines and pictures with reviewers.
 * Needs `lark-cli` logged in as the user (`lark-cli auth login`).
 * - `pnpm transcript:lark push` rebuilds the doc from the same data and stills as
 *   `pnpm transcript` (run that first), creating it on the first run with `config.larkTitle`;
 *   the doc id is kept in `../transcript/lark.json`. A rebuild drops comments, so pull first.
 * - `pnpm transcript:lark pull` is read-only: it lists lines whose text was edited in the doc
 *   and every open comment with the line it sits on. `--apply` also writes the edited text into
 *   `src/script/*.ts`; lines with a `tts` reading are only reported, since that reading has to be
 *   rewritten by hand.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { config } from '../src/config'
import { circled, HOW_TO, OUT, stamp, stillPath, type TranscriptEpisode, type TranscriptLine, type TranscriptScene, transcript, VIDEO } from './transcript-data'

const STATE = path.join(OUT, 'lark.json')

type State = { doc: string; url?: string }

const sleep = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)

/**
 * Runs lark-cli as the user; `cwd` matters for uploads, which only accept paths inside the working directory.
 * Network failures are retried, since a push makes one call per scene and still.
 */
const cli = (args: string[], cwd?: string) => {
  for (let attempt = 1; ; attempt++) {
    try {
      const out = execFileSync('lark-cli', [...args, '--as', 'user'], { encoding: 'utf8', maxBuffer: 256 << 20, cwd, stdio: ['ignore', 'pipe', 'pipe'] })
      const json = JSON.parse(out)
      if (json.ok === false) throw new Error(out)
      return json.data ?? json
    } catch (error) {
      const detail = `${(error as { stderr?: string }).stderr ?? ''}${(error as Error).message}`
      if (attempt >= 5 || !/"type": "network"|TLS handshake timeout|ECONNRESET/.test(detail)) throw error
      console.log(`network error, retry ${attempt}: ${args.slice(0, 2).join(' ')}`)
      sleep(3000 * attempt)
    }
  }
}

/** Plain text safe for Lark-flavored Markdown. */
const esc = (text: string) => text.replace(/([*~`$[\]<>{}|^\\])/g, '\\$1')
const unesc = (text: string) => text.replace(/\\([*~`$[\]<>{}|^\\])/g, '$1')

/** One transcript line; `pull` parses this exact shape back, so change both together. */
const LINE = (line: TranscriptLine) => `- **#${line.n}** \`${stamp(line.at)}\` ${esc(line.text)} ｜\`${line.id}\``

const sceneMarkdown = (scene: TranscriptScene) =>
  [
    `## ${circled(scene.index)} ${esc(scene.title)} · ${stamp(scene.from)}–${stamp(scene.to)}`,
    '',
    `画面：\`${scene.file}\` › \`${scene.component}\`　场景 \`${scene.id}\`　小节 ${scene.section} ${esc(scene.sectionTitle)}`,
    '',
    ...(scene.lines.length ? scene.lines.flatMap(line => [LINE(line), ...(line.tts ? [`  - 配音读作：${esc(line.tts)}`] : [])]) : ['- （无口播，只有画面）']),
    '',
  ].join('\n')

const episodeHeader = (episode: TranscriptEpisode) =>
  [
    `# ${episode.tag} ${esc(episode.title)}`,
    '',
    `<callout emoji="🎬" background-color="light-blue">`,
    `时长 ${stamp(episode.duration)}　合集里从 ${stamp(episode.offset)} 开始　逐字稿 \`video/src/script/${episode.id}.ts\`　视频 \`out/${episode.id}.mp4\``,
    `</callout>`,
    '',
  ].join('\n')

const intro = (list: TranscriptEpisode[]) =>
  [
    '<callout emoji="💡" background-color="light-yellow">',
    ...HOW_TO.filter(Boolean),
    '</callout>',
    '',
    '每一集下面按场景列出：场景编号（①②③…）、时间段、画面由哪个组件文件负责，再逐句列出口播（#序号、时间码、句子 id），最后是这个场景每句话对应的画面截图（格子里标着同样的 #序号）。',
    '',
    '| 集 | 时长 | 合集起点 | 句数 |',
    '| --- | --- | --- | --- |',
    ...list.map(e => `| ${e.tag} ${esc(e.title)} | ${stamp(e.duration)} | ${stamp(e.offset)} | ${e.scenes.reduce((n, s) => n + s.lines.length, 0)} |`),
    '',
    `生成于 ${new Date().toISOString().slice(0, 10)}，时间码对应当时的成片。`,
    '',
  ].join('\n')

const push = () => {
  const list = transcript()
  const missing = list.flatMap(e => e.scenes.map(s => stillPath(e, s))).filter(f => !fs.existsSync(f))
  if (missing.length) throw new Error(`run \`pnpm transcript\` first; ${missing.length} stills are missing, e.g. ${missing[0]}`)
  let state: State | undefined = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : undefined
  if (state) cli(['docs', '+update', '--doc', state.doc, '--mode', 'overwrite', '--markdown', intro(list)])
  else {
    const created = cli(['docs', '+create', '--title', config.larkTitle, '--markdown', intro(list)])
    state = { doc: created.doc_id, url: created.doc_url }
    fs.writeFileSync(STATE, `${JSON.stringify(state, null, 2)}\n`)
  }
  for (const episode of list) {
    cli(['docs', '+update', '--doc', state.doc, '--mode', 'append', '--markdown', episodeHeader(episode)])
    for (const scene of episode.scenes) {
      cli(['docs', '+update', '--doc', state.doc, '--mode', 'append', '--markdown', sceneMarkdown(scene)])
      const caption = scene.lines.length ? `${episode.tag} ${circled(scene.index)} 画面：#${scene.lines[0].n}–#${scene.lines.at(-1)?.n}` : `${episode.tag} ${circled(scene.index)} 画面`
      const still = stillPath(episode, scene)
      cli(['docs', '+media-insert', '--doc', state.doc, '--file', `./${path.basename(still)}`, '--caption', caption], path.dirname(still))
    }
    console.log(`${episode.tag} pushed`)
  }
  console.log(state.url ?? state.doc)
}

const fetchMarkdown = (doc: string) => {
  let markdown = ''
  let offset = 0
  for (;;) {
    const page = cli(['docs', '+fetch', '--doc', doc, '--offset', String(offset)])
    markdown += page.markdown
    if (!page.has_more) return markdown
    offset = page.next_offset
  }
}

type Comment = { quote?: string; reply_list?: { replies?: { content?: { elements?: { text_run?: { text?: string } }[] } }[] } }

const openComments = (doc: string) => {
  const data = cli(['drive', 'file.comments', 'list', '--page-all', '--params', JSON.stringify({ file_token: doc, file_type: 'docx', is_solved: false })])
  return ((data.items ?? []) as Comment[]).map(item => ({
    quote: item.quote ?? '',
    text: (item.reply_list?.replies ?? []).map(r => (r.content?.elements ?? []).map(e => e.text_run?.text ?? '').join('')).join(' / '),
  }))
}

const scriptFile = (id: string) => path.join(VIDEO, 'src/script', `${id}.ts`)
const quote = (text: string) => `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
const regex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Rewrites one line's `text` in its script file; false when the source no longer matches. */
const applyEdit = (episodeId: string, line: TranscriptLine, text: string) => {
  const file = scriptFile(episodeId)
  const source = fs.readFileSync(file, 'utf8')
  const pattern = new RegExp(`(id: '${regex(line.id)}',\\s*text: )${regex(quote(line.text))}`)
  if (!pattern.test(source)) return false
  fs.writeFileSync(file, source.replace(pattern, (_, head: string) => `${head}${quote(text)}`))
  return true
}

const pull = (apply: boolean) => {
  if (!fs.existsSync(STATE)) throw new Error('no Lark transcript yet; run `pnpm transcript:lark push`')
  const { doc } = JSON.parse(fs.readFileSync(STATE, 'utf8')) as State
  const markdown = fetchMarkdown(doc)
  const lines = new Map(transcript().flatMap(e => e.scenes.flatMap(s => s.lines.map(l => [l.id, { episode: e, line: l }] as const))))
  const seen = new Set<string>()
  let edits = 0
  for (const raw of markdown.split('\n')) {
    const m = raw.match(/^\s*[-*]\s+\*\*#\d+\*\*\s+`[\d:]+`\s+(.*?)\s*｜\s*`([\w-]+)`\s*$/)
    if (!m) continue
    const [, text, id] = m
    const hit = lines.get(id)
    if (!hit) continue
    seen.add(id)
    const edited = unesc(text).trim()
    if (edited === hit.line.text) continue
    edits += 1
    console.log(`\n${hit.episode.tag} #${hit.line.n} ${id}\n  原文：${hit.line.text}\n  改为：${edited}`)
    if (hit.line.tts) console.log(`  这句有配音读法（tts: ${hit.line.tts}），要手动一起改`)
    else if (apply) console.log(applyEdit(hit.episode.id, hit.line, edited) ? '  已写回脚本' : '  脚本里找不到原句，没改')
  }
  const lost = [...lines.keys()].filter(id => !seen.has(id))
  if (lost.length) console.log(`\n文档里找不到这些句子（可能被删了或格式被改动）：${lost.join('、')}`)
  const comments = openComments(doc)
  for (const c of comments) {
    const on = [...lines.values()].find(({ line }) => c.quote && line.text.includes(c.quote))
    console.log(`\n评论 ${on ? `${on.episode.tag} #${on.line.n} ${on.line.id}` : '（未对应到句子）'}\n  选中：${c.quote}\n  内容：${c.text}`)
  }
  console.log(`\n${edits} 处改字，${comments.length} 条未解决评论。${apply ? '' : '加 --apply 把改字写回脚本。'}`)
}

const [command] = process.argv.slice(2)
if (command === 'push') push()
else if (command === 'pull') pull(process.argv.includes('--apply'))
else throw new Error('usage: transcript:lark push | pull [--apply]')
