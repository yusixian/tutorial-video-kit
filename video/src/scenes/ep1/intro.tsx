import type { FC } from 'react'
import { useCurrentFrame } from 'remotion'
import { Appear, Card, ContentArea, Pill, PointHeader } from '../../chrome/Cards'
import { EpisodeTitle } from '../../chrome/EpisodeTitle'
import { useScene } from '../../episode/Episode'
import { Sfx } from '../../episode/Sfx'
import { easeInOut, land, progress, visible } from '../../lib/anim'
import { cueTextFrame } from '../../lib/captions'
import { FPS, type LineTiming } from '../../lib/timeline'
import { ep1 } from '../../script/ep1'
import { fonts, theme } from '../../theme'

export const Title: FC = () => (
  <>
    <EpisodeTitle episode={ep1} />
    <Sfx at={4} name="whoosh" volume={0.35} />
  </>
)

/** In narration order; each card lands on the word that names it. */
const STEPS = [
  { word: '写脚本', command: 'src/script/ep1.ts', note: '台词、字幕和场景' },
  { word: '配音', command: 'pnpm tts', note: '逐句合成，按句缓存' },
  { word: '排时间线', command: 'pnpm timing ep1', note: '按配音时长排场景' },
  { word: '渲染', command: 'pnpm render', note: '每集渲染一个 MP4' },
  { word: '交付', command: 'pnpm finalize', note: '响度归一、交付检查' },
]
const CACHED = ['ep1-pipeline-01', 'ep1-pipeline-02', 'ep1-pipeline-03', 'ep1-script-01', 'ep1-script-02', 'ep1-script-03']

export const Pipeline: FC = () => {
  const { lines, L } = useScene()
  const frame = useCurrentFrame()
  const stepAt = STEPS.map(s => cueTextFrame(lines[0], s.word))
  const focusAt = cueTextFrame(lines[1], '改了哪一步')
  const rerunAt = cueTextFrame(lines[1], '重新跑')
  const focus = progress(frame, focusAt, 12, easeInOut)
  return (
    <>
      <ContentArea>
        <div style={{ position: 'absolute', left: 120, top: 90 }}>
          <PointHeader kicker="1-1" title="五个步骤" />
        </div>
        <div style={{ position: 'absolute', left: 120, right: 120, top: 330, display: 'flex', gap: 24 }}>
          {STEPS.map((step, i) => {
            const settle = land(frame, stepAt[i])
            const chosen = i === 1
            return (
              <div
                key={step.word}
                style={{
                  flex: 1,
                  position: 'relative',
                  opacity: progress(frame, stepAt[i], 10) * (chosen ? 1 : 1 - focus * 0.6),
                  transform: `translateY(${(1 - settle) * 28}px)`,
                }}
              >
                <Card active={chosen && focus > 0.5} style={{ height: 280, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <span style={{ fontFamily: fonts.mono, fontSize: 24, fontWeight: 700, color: theme.accent }}>{String(i + 1).padStart(2, '0')}</span>
                  <span style={{ fontSize: 44, fontWeight: 800 }}>{step.word}</span>
                  <span style={{ alignSelf: 'flex-start', fontFamily: fonts.mono, fontSize: 19, padding: '5px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.07)' }}>
                    {step.command}
                  </span>
                  <span style={{ marginTop: 'auto', fontSize: 22, color: theme.dim }}>{step.note}</span>
                </Card>
                {chosen ? (
                  <Appear at={rerunAt} y={10} style={{ position: 'absolute', right: 18, top: -20 }}>
                    <Pill tone="accent" size={20}>
                      只重跑这一步
                    </Pill>
                  </Appear>
                ) : null}
              </div>
            )
          })}
        </div>
        <div style={{ position: 'absolute', left: 120, right: 120, top: 660, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px 24px' }}>
          {CACHED.map((id, i) => {
            const fresh = id === 'ep1-script-02'
            return (
              <Appear key={id} at={L(2) + i * 4} y={12} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ fontFamily: fonts.mono, fontSize: 20, color: theme.dim }}>{id}</span>
                <Pill tone={fresh ? 'accent' : 'dark'} size={18}>
                  {fresh ? '改过 · 重新合成' : '命中缓存'}
                </Pill>
              </Appear>
            )
          })}
        </div>
      </ContentArea>
      {stepAt.map(at => (
        <Sfx key={at} at={at} name="pop" volume={0.28} />
      ))}
    </>
  )
}

const seconds = (frames: number) => `${(frames / FPS).toFixed(1)}s`

const CodeLine: FC<{ name: string; value: string; mono?: boolean }> = ({ name, value, mono }) => (
  <div style={{ display: 'flex', gap: 14, paddingLeft: 30 }}>
    <span style={{ fontFamily: fonts.mono, color: theme.brandLight, flexShrink: 0 }}>{name}:</span>
    <span style={{ fontFamily: mono ? fonts.mono : fonts.sans, color: mono ? theme.text : theme.good, wordBreak: 'break-all' }}>{value}</span>
  </div>
)

/** The line as it is written in `src/script/ep1.ts`, with the timing the timeline gives it. */
const LineSource: FC<{ line: LineTiming }> = ({ line }) => (
  <div style={{ fontSize: 25, lineHeight: 1.65 }}>
    <div style={{ fontFamily: fonts.mono, color: theme.faint }}>{'{'}</div>
    <CodeLine name="id" value={`'${line.id}'`} mono />
    <CodeLine name="text" value={`'${line.text}'`} />
    {line.tts ? <CodeLine name="tts" value={`'${line.tts}'`} /> : null}
    {line.em ? <CodeLine name="em" value={`[${line.em.map(e => `'${e}'`).join(', ')}]`} /> : null}
    <div style={{ fontFamily: fonts.mono, color: theme.faint }}>{'}'}</div>
    <div style={{ marginTop: 22, fontFamily: fonts.mono, fontSize: 21, color: theme.dim }}>
      from {line.from}f · duration {line.duration}f
    </div>
  </div>
)

export const ScriptData: FC = () => {
  const { lines, L, duration } = useScene()
  const frame = useCurrentFrame()
  const width = 700
  const x = (f: number) => (f / duration) * width
  return (
    <ContentArea>
      <div style={{ position: 'absolute', left: 120, top: 90 }}>
        <PointHeader kicker="1-1" title="脚本即数据" />
      </div>
      <Card style={{ position: 'absolute', left: 120, top: 300, width: 860, height: 400 }}>
        <div style={{ fontFamily: fonts.mono, fontSize: 20, color: theme.faint, marginBottom: 14 }}>src/script/ep1.ts</div>
        <div style={{ position: 'relative' }}>
          {lines.map((line, i) => {
            const opacity = visible(frame, i === 0 ? -10 : line.from - 8, i === lines.length - 1 ? duration + 30 : lines[i + 1].from - 8, 8)
            return opacity > 0 ? (
              <div key={line.id} style={{ position: 'absolute', inset: 0, opacity }}>
                <LineSource line={line} />
              </div>
            ) : null
          })}
        </div>
      </Card>
      <Appear at={8} style={{ position: 'absolute', left: 1080, top: 300, width }}>
        <div style={{ fontSize: 26, color: theme.dim, marginBottom: 22 }}>这一场的时间线</div>
        <div style={{ position: 'relative', height: 64, borderRadius: 10, background: 'rgba(255,255,255,0.05)' }}>
          {lines.map((line, i) => (
            <div
              key={line.id}
              style={{
                position: 'absolute',
                left: x(line.from),
                top: 8,
                width: x(line.duration),
                height: 48,
                borderRadius: 8,
                background: frame >= line.from ? theme.brand : 'rgba(76, 125, 255, 0.35)',
                display: 'grid',
                placeItems: 'center',
                fontFamily: fonts.mono,
                fontSize: 20,
                fontWeight: 700,
              }}
            >
              #{i + 1}
            </div>
          ))}
          <div style={{ position: 'absolute', left: x(Math.min(frame, duration)) - 1.5, top: -8, bottom: -8, width: 3, borderRadius: 2, background: theme.accent }} />
        </div>
        <div style={{ position: 'relative', height: 30, marginTop: 10, fontFamily: fonts.mono, fontSize: 18, color: theme.faint }}>
          {lines.map(line => (
            <span key={line.id} style={{ position: 'absolute', left: x(line.from) }}>
              {seconds(line.duration)}
            </span>
          ))}
        </div>
      </Appear>
      <Appear at={L(2)} style={{ position: 'absolute', left: 1080, top: 520, width }}>
        <div style={{ fontSize: 26, color: theme.dim, marginBottom: 16 }}>时长从哪来</div>
        {lines.map((line, i) => (
          <div key={line.id} style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12, fontSize: 24 }}>
            <span style={{ fontFamily: fonts.mono, width: 48, color: theme.faint }}>#{i + 1}</span>
            <Pill tone={line.audio ? 'brand' : 'dark'} size={18}>
              {line.audio ? '配音实测' : '阅读速度估算'}
            </Pill>
            <span style={{ fontFamily: fonts.mono, color: theme.dim }}>{seconds(line.duration)}</span>
          </div>
        ))}
      </Appear>
    </ContentArea>
  )
}
