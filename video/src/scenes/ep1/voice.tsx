import type { FC } from 'react'
import { useCurrentFrame } from 'remotion'
import { Appear, Card, ContentArea, PointHeader } from '../../chrome/Cards'
import { useScene } from '../../episode/Episode'
import { Sfx } from '../../episode/Sfx'
import { land, progress, typed, visible } from '../../lib/anim'
import { cueTextFrame } from '../../lib/captions'
import { episodeTag } from '../../script/episodes'
import { ep2 } from '../../script/ep2'
import { fonts, theme } from '../../theme'

/** Display form and reading of each figure in `ep1-voice-01`, in narration order. */
const SPECS = [
  { shown: '1080p', said: '一零八零 P' },
  { shown: '30 fps', said: '三十帧每秒' },
  { shown: '-15 LUFS', said: '负十五 LUFS' },
]

const Row: FC<{ label: string; value: string; tone?: string }> = ({ label, value, tone = theme.text }) => (
  <div style={{ marginBottom: 26 }}>
    <div style={{ fontFamily: fonts.mono, fontSize: 21, color: theme.faint, marginBottom: 8 }}>{label}</div>
    <div style={{ fontSize: 32, lineHeight: 1.5, color: tone }}>{value}</div>
  </div>
)

/** Subtitle `text` against what the voice said, spec figures landing on their spoken words, a pinned polyphone, and `em`. */
export const Voice: FC = () => {
  const { lines, L, duration } = useScene()
  const frame = useCurrentFrame()
  const specAt = SPECS.map(s => cueTextFrame(lines[0], s.shown))
  const pinAt = cueTextFrame(lines[1], '「当成」')
  const until = (i: number) => (i < lines.length - 1 ? L(i + 1) - 4 : duration + 30)
  return (
    <>
      <ContentArea>
        <div style={{ position: 'absolute', left: 120, top: 90 }}>
          <PointHeader kicker="1-3" title="读法与重点" />
        </div>
        <div style={{ position: 'absolute', left: 120, top: 330, width: 780 }}>
          {lines.map((line, i) => {
            const opacity = visible(frame, i === 0 ? 6 : L(i) - 4, until(i))
            return opacity > 0 ? (
              <div key={line.id} style={{ position: 'absolute', inset: 0, opacity }}>
                <Row label="字幕 · text" value={line.text} />
                <Row label={line.speech ? '配音实际念的' : line.tts ? '配音 · tts' : '配音 · 同字幕'} value={line.speech?.text ?? line.tts ?? line.text} tone={theme.brandLight} />
              </div>
            ) : null
          })}
        </div>
        <div style={{ position: 'absolute', left: 1000, top: 120, width: 800, height: 660 }}>
          <div style={{ position: 'absolute', inset: 0, opacity: visible(frame, 0, until(0)), display: 'flex', flexDirection: 'column', gap: 24, justifyContent: 'center' }}>
            {SPECS.map((spec, i) => {
              const settle = land(frame, specAt[i])
              return (
                <div key={spec.shown} style={{ opacity: progress(frame, specAt[i], 8), transform: `translateX(${(1 - settle) * 40}px)` }}>
                  <Card style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: fonts.mono, fontSize: 60, fontWeight: 800, color: i === 2 ? theme.accent : theme.text }}>{spec.shown}</span>
                    <span style={{ fontSize: 26, color: theme.dim }}>念作「{spec.said}」</span>
                  </Card>
                </div>
              )
            })}
          </div>
          <div style={{ position: 'absolute', inset: 0, opacity: visible(frame, pinAt, until(1)), display: 'grid', placeItems: 'center' }}>
            <Card style={{ width: 640, textAlign: 'center', padding: '44px 40px' }}>
              <div style={{ fontSize: 120, fontWeight: 900, lineHeight: 1.3 }}>
                <ruby>
                  当<rt style={{ fontSize: 34, color: theme.accent, fontFamily: fonts.mono }}>dàng</rt>
                </ruby>
                成
              </div>
              <div style={{ marginTop: 20, fontSize: 30, color: theme.dim }}>
                配音前换成同音的「<span style={{ color: theme.accent }}>荡</span>成」
              </div>
              <div style={{ marginTop: 14, fontFamily: fonts.mono, fontSize: 20, color: theme.faint }}>scripts/spoken-text.ts</div>
            </Card>
          </div>
          <div style={{ position: 'absolute', inset: 0, opacity: visible(frame, L(2), until(2)), display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 36 }}>
            <Card>
              <span style={{ fontFamily: fonts.mono, fontSize: 30 }}>
                <span style={{ color: theme.brandLight }}>em</span>: [<span style={{ color: theme.good }}>'强调色'</span>]
              </span>
            </Card>
            <div style={{ alignSelf: 'center', padding: '12px 28px', borderRadius: 14, background: 'rgba(12, 14, 18, 0.84)', fontSize: 38, fontWeight: 600, border: `1px solid ${theme.line}` }}>
              字幕里就会换成<span style={{ color: theme.accent }}>强调色</span>
            </div>
          </div>
        </div>
      </ContentArea>
      {specAt.map(at => (
        <Sfx key={at} at={at} name="pop" volume={0.26} />
      ))}
      <Sfx at={pinAt} name="pop" volume={0.26} />
    </>
  )
}

const NEXT = ['检查成片', '生成逐字稿', '投稿素材']

export const Outro: FC = () => {
  const { lines } = useScene()
  const frame = useCurrentFrame()
  const itemAt = NEXT.map(item => cueTextFrame(lines[0], item))
  const commandAt = cueTextFrame(lines[1], 'pnpm studio')
  return (
    <ContentArea>
      <div style={{ position: 'absolute', left: 120, top: 90 }}>
        <PointHeader kicker={`下一集 · ${episodeTag(ep2)}`} title={ep2.title} />
      </div>
      <div style={{ position: 'absolute', left: 120, top: 360, display: 'flex', flexDirection: 'column', gap: 26 }}>
        {NEXT.map((item, i) => (
          <Appear key={item} at={itemAt[i]} y={14} style={{ display: 'flex', alignItems: 'center', gap: 22, fontSize: 40, fontWeight: 700 }}>
            <span style={{ width: 52, height: 52, borderRadius: '50%', display: 'grid', placeItems: 'center', background: theme.inkRaise, border: `1.5px solid ${theme.line}`, fontFamily: fonts.mono, fontSize: 24, color: theme.accent }}>
              {i + 1}
            </span>
            {item}
          </Appear>
        ))}
      </div>
      <Appear at={commandAt - 6} style={{ position: 'absolute', left: 1000, top: 360, width: 800 }}>
        <Card style={{ fontFamily: fonts.mono, fontSize: 30, lineHeight: 1.7 }}>
          <div style={{ fontSize: 20, color: theme.faint, marginBottom: 10 }}>video/</div>
          <div>
            <span style={{ color: theme.good }}>$ </span>
            {typed('pnpm studio', frame, commandAt)}
            <span style={{ opacity: Math.floor(frame / 15) % 2 ? 0 : 1, color: theme.accent }}>▍</span>
          </div>
          <div style={{ color: theme.dim, fontSize: 24, opacity: progress(frame, commandAt + 30, 12) }}>在浏览器里打开 EP1，逐帧拖着看</div>
        </Card>
      </Appear>
    </ContentArea>
  )
}
