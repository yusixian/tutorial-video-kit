import type { FC } from 'react'
import { useCurrentFrame } from 'remotion'
import { Callout, clickAt, Cursor, cursorAt, type CursorKey, Spotlight, Stage } from '../../chrome/Stage'
import { useScene } from '../../episode/Episode'
import { Sfx } from '../../episode/Sfx'
import { progress } from '../../lib/anim'
import { type Box, pad } from '../../lib/boxes'
import { cueTextFrame } from '../../lib/captions'
import { APP, crfAtX, ExportApp, KNOB_Y, knobX } from './app'

/**
 * The 烧录字幕 and 画质 rows, framed a little low so the view clears the panel header;
 * the zoom is capped so the preview's burned-in caption stays in view.
 */
const CONTROLS: Box = [1484, 410, 376, 230]

/** Camera push-in on the settings, a click that turns subtitles on, one spotlight sliding to a dragged slider, then an export. */
export const Panel: FC = () => {
  const { L, E, lines } = useScene()
  const frame = useCurrentFrame()
  const toggleAt = L(1) + 40
  const slideAt = cueTextFrame(lines[2], '会直接滑过去')
  const dragFrom = slideAt + 14
  const dragTo = dragFrom + 24
  const exportAt = L(3) + 46
  const cursor: CursorKey[] = [
    { at: L(1) - 4, x: 1260, y: 560 },
    clickAt(toggleAt, APP.toggle),
    { at: dragFrom, x: knobX(23), y: KNOB_Y },
    { at: dragTo, x: knobX(18), y: KNOB_Y, drag: true },
    clickAt(exportAt, APP.export),
  ]
  const crf = frame < dragFrom ? 23 : crfAtX(cursorAt(Math.min(frame, dragTo), cursor).x)
  return (
    <>
      <Stage camera={[{ at: 0 }, { at: L(0) + 20, box: CONTROLS, maxZoom: 1.5 }, { at: L(3), dur: 30 }]}>
        <ExportApp subtitles={progress(frame, toggleAt, 8)} crf={crf} exported={frame >= exportAt ? progress(frame, exportAt + 4, 60, t => t) : undefined} />
        <Spotlight box={pad(APP.subtitles, 8)} from={L(2)} to={slideAt} />
        <Spotlight box={pad(APP.quality, 8)} from={slideAt} to={E(2) + 6} />
        <Callout box={pad(APP.quality, 8)} from={dragTo} to={E(2) + 6} text={`画质 · CRF ${crf}`} side="left" size={22} />
        <Cursor keys={cursor} hideAt={E(3)} />
      </Stage>
      <Sfx at={toggleAt} name="click" />
      <Sfx at={exportAt} name="click" />
      <Sfx at={exportAt + 64} name="chime" volume={0.35} />
    </>
  )
}
