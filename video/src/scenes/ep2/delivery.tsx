import type { FC } from 'react'
import { useCurrentFrame } from 'remotion'
import { Appear, Card, ContentArea, Pill, PointHeader } from '../../chrome/Cards'
import { EpisodeTitle } from '../../chrome/EpisodeTitle'
import { useScene } from '../../episode/Episode'
import { Sfx } from '../../episode/Sfx'
import { land, progress } from '../../lib/anim'
import { cueTextFrame } from '../../lib/captions'
import { chapters, clock } from '../../lib/chapters'
import { timeEpisode } from '../../lib/timeline'
import { ep1 } from '../../script/ep1'
import { ep2 } from '../../script/ep2'
import { fonts, theme } from '../../theme'

export const Title: FC = () => (
  <>
    <EpisodeTitle episode={ep2} />
    <Sfx at={4} name="whoosh" volume={0.35} />
  </>
)

/** What `pnpm delivery-check` compares, keyed by the word that ticks it off. */
const CHECKS = [
  { word: '帧数', detail: '帧数和时间线一致' },
  { word: '分辨率', detail: '1920 × 1080 · 30 fps' },
  { word: '色彩空间', detail: 'BT.709 · yuv420p' },
  { word: '音画同步', detail: '音视频时长差不到一帧' },
]

const Tick: FC<{ at: number }> = ({ at }) => {
  const frame = useCurrentFrame()
  const p = progress(frame, at, 10)
  return (
    <span style={{ position: 'relative', width: 44, height: 44, flexShrink: 0, borderRadius: '50%', border: `2px solid ${p > 0 ? theme.good : theme.faint}`, background: p > 0 ? 'rgba(110, 231, 168, 0.14)' : 'transparent' }}>
      <svg width={44} height={44} viewBox="0 0 44 44" style={{ position: 'absolute', left: -2, top: -2 }}>
        <path d="M13 23l6 6 12-13" fill="none" stroke={theme.good} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} />
      </svg>
    </span>
  )
}

export const Check: FC = () => {
  const { lines } = useScene()
  const frame = useCurrentFrame()
  const loudnessAt = cueTextFrame(lines[0], '两遍响度归一')
  const checkAt = cueTextFrame(lines[0], '交付检查')
  const tickAt = CHECKS.map(c => cueTextFrame(lines[1], c.word))
  const gateAt = cueTextFrame(lines[1], '有一项对不上')
  return (
    <>
      <ContentArea>
        <div style={{ position: 'absolute', left: 120, top: 90 }}>
          <PointHeader kicker="2-1" title="交付检查" />
        </div>
        <div style={{ position: 'absolute', left: 120, top: 340, width: 760, display: 'flex', flexDirection: 'column', gap: 22 }}>
          {[
            { at: loudnessAt, step: '1', title: '响度归一', command: 'pnpm finalize', note: '-15 LUFS · -1 dBTP，量两遍再调' },
            { at: checkAt, step: '2', title: '交付检查', command: 'pnpm delivery-check', note: '逐项核对，最后完整解码一遍' },
          ].map(item => (
            <Appear key={item.step} at={item.at} y={16}>
              <Card style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
                <span style={{ fontFamily: fonts.mono, fontSize: 40, fontWeight: 800, color: theme.accent }}>{item.step}</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span style={{ fontSize: 36, fontWeight: 800 }}>{item.title}</span>
                  <span style={{ fontFamily: fonts.mono, fontSize: 21, color: theme.brandLight }}>{item.command}</span>
                  <span style={{ fontSize: 22, color: theme.dim }}>{item.note}</span>
                </div>
              </Card>
            </Appear>
          ))}
        </div>
        <Appear at={checkAt + 4} style={{ position: 'absolute', left: 1000, top: 340, width: 800 }}>
          <Card style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
            {CHECKS.map((check, i) => (
              <div key={check.word} style={{ display: 'flex', alignItems: 'center', gap: 22, opacity: 0.45 + 0.55 * progress(frame, tickAt[i], 8) }}>
                <Tick at={tickAt[i]} />
                <span style={{ width: 150, fontSize: 32, fontWeight: 700 }}>{check.word}</span>
                <span style={{ fontSize: 23, color: theme.dim }}>{check.detail}</span>
              </div>
            ))}
          </Card>
          <div style={{ marginTop: 24, opacity: progress(frame, gateAt, 10), transform: `scale(${0.9 + 0.1 * land(frame, gateAt)})`, transformOrigin: 'left center' }}>
            <Pill tone="accent" size={24}>
              全部通过才算交付
            </Pill>
          </div>
        </Appear>
      </ContentArea>
      {tickAt.map(at => (
        <Sfx key={at} at={at} name="pop" volume={0.26} />
      ))}
    </>
  )
}

const ellipsis = (text: string, max: number) => ([...text].length > max ? `${[...text].slice(0, max).join('')}…` : text)

export const Publish: FC = () => {
  const { lines, L } = useScene()
  const frame = useCurrentFrame()
  const timing = timeEpisode(ep1)
  const numbered = timing.scenes.flatMap(s => s.lines.map(l => ({ id: l.id, at: s.from + l.from, text: l.text }))).slice(0, 5)
  const chapterAt = cueTextFrame(lines[1], '章节时间码')
  const swap = L(2) - 4
  const files = [
    { what: '脚本', path: 'src/script/ep1.ts', at: cueTextFrame(lines[2], '脚本') },
    { what: '画面', path: 'src/scenes/ep1/', at: cueTextFrame(lines[2], '画面') },
  ]
  return (
    <ContentArea>
      <div style={{ position: 'absolute', left: 120, top: 90 }}>
        <PointHeader kicker="2-2" title="逐字稿与投稿" />
      </div>
      <Appear at={8} out={swap} style={{ position: 'absolute', left: 120, top: 320, width: 820 }}>
        <Card style={{ height: 440, boxSizing: 'border-box' }}>
          <div style={{ fontFamily: fonts.mono, fontSize: 20, color: theme.faint, marginBottom: 20 }}>transcript/ep1.md</div>
          {numbered.map((line, i) => (
            <div key={line.id} style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, opacity: progress(frame, 10 + i * 5, 10) }}>
              <span style={{ width: 64, height: 36, flexShrink: 0, borderRadius: 6, background: 'linear-gradient(135deg, #2A3348, #3E4E70)' }} />
              <span style={{ fontFamily: fonts.mono, fontSize: 21, color: theme.accent, flexShrink: 0 }}>#{i + 1}</span>
              <span style={{ fontFamily: fonts.mono, fontSize: 21, color: theme.faint, flexShrink: 0 }}>{clock(line.at).slice(3)}</span>
              <span style={{ fontSize: 24, whiteSpace: 'nowrap' }}>{ellipsis(line.text, 17)}</span>
            </div>
          ))}
        </Card>
      </Appear>
      <Appear at={chapterAt} out={swap} style={{ position: 'absolute', left: 1000, top: 320, width: 800 }}>
        <Card style={{ height: 440, boxSizing: 'border-box', overflow: 'hidden' }}>
          <div style={{ fontFamily: fonts.mono, fontSize: 20, color: theme.faint, marginBottom: 16 }}>publish/ep1.md · 置顶评论</div>
          {chapters(ep1).map((line, i) =>
            line ? (
              <div key={i} style={{ fontSize: 22, lineHeight: 1.45, opacity: progress(frame, chapterAt + i * 3, 8), color: line.startsWith('【') ? theme.brandLight : theme.text, fontFamily: line.startsWith('【') ? fonts.sans : fonts.mono }}>
                {line}
              </div>
            ) : (
              <div key={i} style={{ height: 10 }} />
            ),
          )}
        </Card>
      </Appear>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 380, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>
        {files.map(file => (
          <Appear key={file.path} at={file.at} y={16} style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
            <span style={{ width: 120, textAlign: 'right', fontSize: 44, fontWeight: 800 }}>{file.what}</span>
            <span style={{ fontFamily: fonts.mono, fontSize: 40, padding: '10px 26px', borderRadius: 14, background: theme.inkRaise, border: `1.5px solid ${theme.accent}` }}>{file.path}</span>
          </Appear>
        ))}
      </div>
    </ContentArea>
  )
}
