/**
 * Writes a teleprompter for recording the narration yourself: `pnpm prompter [ep1 …] [--pdf]` →
 * `../voice/提词稿.html` (or `提词稿-ep1.html` for the named episodes). Lines come from the scripts in
 * episode order as they are spoken (`tts ?? text` through `readingText`), with the polyphones
 * `tts.ts` pins shown in pinyin and `em` phrases in bold. Numbers match the transcript, so "EP1 #12"
 * names the same line in both. `--pdf` also prints an A4 PDF through the installed Google Chrome
 * (found by Playwright's `chrome` channel); without it, the HTML prints to PDF from any browser.
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { config } from '../src/config'
import { episodes } from '../src/script/episodes'
import type { Line } from '../src/script/types'
import { PINYIN, pinPolyphones, READINGS, readingText } from './spoken-text'
import { circled, ROOT, transcript } from './transcript-data'

const OUT = path.join(ROOT, 'voice')
const NAME = '提词稿'
/** Characters per second at an unhurried narration pace, slow to fast. */
const PACE = [4, 5]

const lineById = new Map(episodes.flatMap(e => e.scenes.flatMap(s => s.lines)).map(l => [l.id, l]))
const said = (line: Line) => readingText(line.tts ?? line.text)
const count = (s: string) => [...s].filter(c => /[\p{L}\p{N}]/u.test(c)).length
const escape = (s: string) => s.replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`)
const unescape = (s: string) => s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
const minutes = (chars: number) => [...new Set(PACE.map(p => Math.round((chars / p / 60) * 2) / 2).reverse())].join('–')

/**
 * Boundary map from `from` to `to` through a character edit alignment, for `em` phrases a `tts`
 * rewrite moved. A space never pairs with a character, or "1.5 试" would lend its space to 五.
 */
const align = (from: string, to: string) => {
  const cost = Array.from({ length: from.length + 1 }, (_, i) => Array.from({ length: to.length + 1 }, (_, j) => i + j))
  const swap = (a: string, b: string) => (a === b ? 0 : (a === ' ') !== (b === ' ') ? 3 : 1)
  const step = (i: number, j: number) => cost[i - 1][j - 1] + swap(from[i - 1], to[j - 1])
  for (let i = 1; i <= from.length; i++) for (let j = 1; j <= to.length; j++) cost[i][j] = Math.min(cost[i - 1][j] + 1, cost[i][j - 1] + 1, step(i, j))
  const at: number[] = []
  let i = from.length
  let j = to.length
  at[i] = j
  while (i || j) {
    if (i && j && cost[i][j] === step(i, j)) {
      i--
      j--
    } else if (i && cost[i][j] === cost[i - 1][j] + 1) i--
    else j--
    at[i] = j
  }
  return at
}

const emRanges = (line: Line, text: string) =>
  (line.em ?? []).map(phrase => {
    const direct = text.indexOf(readingText(phrase))
    if (direct >= 0) return [direct, direct + readingText(phrase).length]
    const start = line.text.indexOf(phrase)
    if (start < 0) throw new Error(`${line.id}: em「${phrase}」is not in the subtitle`)
    const at = align(line.text, text)
    let [from, to] = [at[start], at[start + phrase.length]]
    while (from < to && text[from] === ' ') from++
    while (to > from && text[to - 1] === ' ') to--
    if (from === to) throw new Error(`${line.id}: em「${phrase}」maps to nothing`)
    return [from, to]
  })

const renderLine = (line: Line) => {
  const text = said(line)
  const pinned = pinPolyphones(text)
  if (pinned.length !== text.length || [...text].length !== text.length) throw new Error(`${line.id}: unexpected text length`)
  const bold = new Array<boolean>(text.length).fill(false)
  for (const [from, to] of emRanges(line, text)) bold.fill(true, from, to)
  let html = ''
  let pins = 0
  for (let i = 0; i < text.length; i++) {
    if (bold[i] !== (bold[i - 1] ?? false)) html += bold[i] ? '<strong>' : '</strong>'
    if (text[i] === pinned[i]) {
      html += escape(text[i])
      continue
    }
    const pinyin = PINYIN[pinned[i]]
    if (!pinyin) throw new Error(`${line.id}: no pinyin for the pinned「${pinned[i]}」; add it to PINYIN in spoken-text.ts`)
    html += `<ruby>${escape(text[i])}<rt>${pinyin}</rt></ruby>`
    pins++
  }
  if (bold.at(-1)) html += '</strong>'
  if (unescape(html.replace(/<rt>[^<]*<\/rt>/g, '').replace(/<[^>]+>/g, '')) !== text) throw new Error(`${line.id}: rendered text drifted`)
  return { html, pins }
}

/** English words and phrases as a reader meets them, most frequent first. */
const englishTerms = (texts: string[]) => {
  const terms = new Map<string, number>()
  for (const word of texts.flatMap(text => text.match(/[A-Za-z][\w.+-]*(?: [A-Za-z][\w.+-]*)*/g) ?? [])) if (word.length > 1) terms.set(word, (terms.get(word) ?? 0) + 1)
  return [...terms].sort((a, b) => b[1] - a[1])
}

const CSS = `
:root { color-scheme: dark light; --bg: #111317; --fg: #f1f2f5; --muted: #8b909a; --em: #ffd27a; --py: #8cc8ff; --rule: #262a31; }
@media (prefers-color-scheme: light) { :root { --bg: #fbfbfa; --fg: #1b1d21; --muted: #72767e; --em: #9a5b00; --py: #1f63b8; --rule: #e4e6ea; } }
@page { size: A4; margin: 16mm 18mm; }
body { margin: 0; background: var(--bg); color: var(--fg); font: 400 17px/1.7 -apple-system, "PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", "Noto Sans SC", sans-serif; }
main { max-width: 46rem; margin: 0 auto; padding: 3rem 1.5rem 6rem; }
h1 { font-size: 2rem; line-height: 1.3; margin: 0 0 .5rem; }
.meta, .file, h3, .n, .terms { color: var(--muted); }
nav { display: flex; flex-wrap: wrap; gap: .25rem 1.25rem; margin: 1.5rem 0 2rem; }
nav a { color: inherit; }
.guide h2 { font-size: 1.15rem; margin: 2rem 0 .5rem; }
.guide li { margin: .3rem 0; }
.terms { font-size: .9rem; }
.episode { border-top: 1px solid var(--rule); margin-top: 4rem; padding-top: 2rem; }
.episode h2 { font-size: 1.6rem; line-height: 1.35; margin: 0 0 .25rem; }
.file b { color: var(--fg); }
h3 { font-size: 1rem; font-weight: 500; margin: 2.5rem 0 1rem; }
.line { display: grid; grid-template-columns: 2.4rem 1fr; gap: .6rem; align-items: baseline; margin: 0 0 1.4em; font-size: clamp(1.3rem, 3.4vw, 1.85rem); line-height: 1.75; }
.n { font-size: .75rem; text-align: right; font-variant-numeric: tabular-nums; }
strong { color: var(--em); font-weight: 600; }
rt { font-size: .5em; color: var(--py); }
@media print {
  :root { --bg: #fff; --fg: #111; --muted: #777; --em: #8a4b00; --py: #1f5fae; --rule: #ddd; }
  body { font-size: 11pt; }
  main { max-width: none; padding: 0; }
  nav { display: none; }
  .episode { break-before: page; border: 0; margin: 0; padding: 0; }
  h3 { break-after: avoid; }
  .line { font-size: 16pt; break-inside: avoid; }
}`

async function printPdf(html: string, pdf: string) {
  const { chromium } = await import('playwright-core')
  const browser = await chromium.launch({ channel: 'chrome' }).catch(error => {
    throw new Error(`--pdf needs Google Chrome installed (${(error as Error).message.split('\n')[0]}); open the HTML and print it to PDF instead`)
  })
  try {
    const tab = await browser.newPage()
    await tab.goto(pathToFileURL(html).href, { waitUntil: 'load' })
    await tab.pdf({ path: pdf, printBackground: true, preferCSSPageSize: true })
  } finally {
    await browser.close()
  }
}

async function main() {
  const only = process.argv.slice(2).filter(a => !a.startsWith('--'))
  const unknown = only.filter(id => !episodes.some(e => e.id === id))
  if (unknown.length) throw new Error(`unknown episodes: ${unknown.join(', ')}`)
  const list = transcript().filter(e => !only.length || only.includes(e.id))
  const name = only.length ? `${NAME}-${only.join('-')}` : NAME
  let pins = 0
  const spoken: string[] = []
  const sections = list.map(episode => {
    const scenes = episode.scenes.filter(s => s.lines.length)
    const lines = scenes.flatMap(s => s.lines.map(l => ({ n: l.n, line: lineById.get(l.id)! })))
    const chars = lines.reduce((sum, { line }) => sum + count(said(line)), 0)
    const body = scenes.map(scene => {
      const rows = scene.lines.map(({ n, id }) => {
        const line = lineById.get(id)!
        const rendered = renderLine(line)
        pins += rendered.pins
        spoken.push(said(line))
        return `<p class="line" id="${id}"><span class="n">#${n}</span><span>${rendered.html}</span></p>`
      })
      return `<section><h3>${circled(scene.index)} ${scene.section} ${escape(scene.title)}</h3>${rows.join('')}</section>`
    })
    const head = `<h2>${escape(episode.tag)} · ${escape(episode.title)}</h2><p class="file">录成 <b>${episode.id}</b> · ${lines.length} 句 · ${chars} 字 · 约 ${minutes(chars)} 分钟</p>`
    return { episode, lines: lines.length, chars, html: `<section class="episode" id="${episode.id}">${head}${body.join('')}</section>` }
  })
  const lines = sections.reduce((sum, s) => sum + s.lines, 0)
  const chars = sections.reduce((sum, s) => sum + s.chars, 0)
  const subtitles = sections.flatMap(s => s.episode.scenes.flatMap(scene => scene.lines.map(l => l.text)))
  const rewrites = READINGS.filter(([, reading]) => reading)
    .map(([pattern]) => subtitles.map(t => t.match(new RegExp(`[\\w.]*(?:${pattern.source})[\\w.]*`))?.[0]).find(Boolean))
    .filter(form => form !== undefined)
    .map(form => `${escape(form)} 写成 ${escape(readingText(form))}`)
  const terms = englishTerms(spoken).map(([word, n]) => `${escape(word)} ×${n}`)
  const date = new Date().toLocaleDateString('sv-SE')
  const guide = `<section class="guide">
<h2>录之前看一眼</h2><ul>
<li>一集录一个文件，文件名用每集标题下面写的，比如 ep1。</li>
<li>开录后先空着录 5 秒，不说话。</li>
<li>念错了停两秒，从这一句开头重念，不用剪，保留最后一遍。</li>
<li>语速按平时说话来。粗体是这句的重点词，可以稍微重读。</li>
<li>左边灰色的编号不用念。要补录某一句，说「EP1 #12」就能对上。</li>
</ul>
<h2>读音</h2><ul>
${pins ? `<li>带拼音的字照拼音念，共 ${pins} 处，都是配音时专门改过的多音字。</li>` : ''}
<li>数字已经写成读法，照着念；字幕里还是阿拉伯数字。</li>
${rewrites.length ? `<li>这几处按读法改了写法：${rewrites.join('，')}。</li>` : ''}
${terms.length ? `<li>英文词按你平时的读法，前后统一就行。稿子里出现的有：</li></ul><p class="terms">${terms.join(' · ')}</p>` : '</ul>'}</section>`
  const nav = sections.length > 1 ? `<nav>${sections.map(s => `<a href="#${s.episode.id}">${escape(s.episode.tag)}</a>`).join('')}</nav>` : ''
  const title = `${config.series} · 配音${NAME}${only.length ? ` · ${sections.map(s => s.episode.tag).join('、')}` : ''}`
  const page = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(title)}</title><style>${CSS}</style></head><body><main>
<h1>${escape(title)}</h1><p class="meta">${sections.length > 1 ? `共 ${sections.length} 集、` : ''}${lines} 句、${chars} 字，和脚本里现在的台词一致（${date} 生成）。</p>${nav}${guide}${sections.map(s => s.html).join('\n')}</main></body></html>`

  fs.mkdirSync(OUT, { recursive: true })
  const html = path.join(OUT, `${name}.html`)
  fs.writeFileSync(html, page)
  console.log(`${sections.length} episodes, ${lines} lines, ${chars} chars, ${pins} pinned polyphones`)
  console.log(html)
  if (process.argv.includes('--pdf')) {
    const pdf = path.join(OUT, `${name}.pdf`)
    await printPdf(html, pdf)
    console.log(pdf)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
