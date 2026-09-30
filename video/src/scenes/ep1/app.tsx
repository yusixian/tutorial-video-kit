import type { CSSProperties, FC, ReactNode } from 'react'
import { interpolateColors } from 'remotion'
import { type Box, place } from '../../lib/boxes'
import { fonts } from '../../theme'

/** A made-up desktop app drawn on the 1920×1080 page canvas; scenes aim the camera, cursor and spotlights at these boxes. */
export const APP = {
  preview: [330, 112, 1080, 608] as Box,
  progress: [330, 760, 1080, 60] as Box,
  panel: [1456, 96, 432, 820] as Box,
  resolution: [1484, 196, 376, 60] as Box,
  fps: [1484, 318, 376, 56] as Box,
  subtitles: [1484, 408, 376, 64] as Box,
  toggle: [1790, 423, 56, 34] as Box,
  quality: [1484, 494, 376, 108] as Box,
  audio: [1484, 650, 376, 60] as Box,
  export: [1484, 800, 376, 72] as Box,
}

const ui = {
  window: '#F4F5F8',
  surface: '#FFFFFF',
  border: '#E1E4EA',
  text: '#1B1F27',
  dim: '#6B7280',
  brand: '#3A6AF0',
  soft: '#EEF2FD',
}

const TRACK = { x: 1484, y: 562, w: 376 }
const CRF = { low: 30, high: 14 }

/** Knob centre for a CRF value; the slider runs from low quality on the left to high on the right. */
export const knobX = (crf: number) => TRACK.x + ((CRF.low - crf) / (CRF.low - CRF.high)) * TRACK.w
export const crfAtX = (x: number) => Math.round(CRF.low - ((Math.min(Math.max(x, TRACK.x), TRACK.x + TRACK.w) - TRACK.x) / TRACK.w) * (CRF.low - CRF.high))
export const KNOB_Y = TRACK.y + 4

const Label: FC<{ y: number; children: ReactNode; right?: ReactNode }> = ({ y, children, right }) => (
  <div style={{ position: 'absolute', left: 1484, top: y, width: 376, display: 'flex', justifyContent: 'space-between', fontSize: 20, color: ui.dim }}>
    <span>{children}</span>
    {right}
  </div>
)

const Field: FC<{ box: Box; children: ReactNode; style?: CSSProperties }> = ({ box, children, style }) => (
  <div
    style={{
      ...place(box),
      boxSizing: 'border-box',
      display: 'flex',
      alignItems: 'center',
      padding: '0 20px',
      borderRadius: 12,
      border: `1.5px solid ${ui.border}`,
      background: ui.surface,
      fontSize: 22,
      ...style,
    }}
  >
    {children}
  </div>
)

const Chevron = () => (
  <svg width={18} height={18} viewBox="0 0 18 18" style={{ marginLeft: 'auto' }}>
    <path d="M4 7l5 5 5-5" fill="none" stroke={ui.dim} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const NAV = ['项目', '素材', '时间线', '导出', '设置']

/**
 * The app in one state: `subtitles` 0→1 animates the toggle and burns a caption into the preview,
 * `crf` places the quality knob, and `exported` (0→1) fills the export bar once an export has started.
 */
export const ExportApp: FC<{ subtitles: number; crf: number; exported?: number }> = ({ subtitles, crf, exported }) => {
  const [, , tw, th] = APP.toggle
  const [px, py, pw, ph] = APP.preview
  const done = exported !== undefined && exported >= 1
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        borderRadius: 18,
        background: ui.window,
        color: ui.text,
        fontFamily: fonts.sans,
        boxShadow: '0 30px 90px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)',
      }}
    >
      <div style={{ ...place([0, 0, 1920, 64]), display: 'flex', alignItems: 'center', justifyContent: 'center', background: ui.surface, borderBottom: `1px solid ${ui.border}`, fontSize: 21, color: ui.dim }}>
        <div style={{ position: 'absolute', left: 24, display: 'flex', gap: 10 }}>
          {[0, 1, 2].map(i => (
            <span key={i} style={{ width: 14, height: 14, borderRadius: '50%', background: '#D5D9E0' }} />
          ))}
        </div>
        示例应用 · 导出
      </div>
      <div style={{ ...place([0, 64, 280, 1016]), background: ui.surface, borderRight: `1px solid ${ui.border}`, padding: '28px 16px', boxSizing: 'border-box' }}>
        {NAV.map(item => {
          const active = item === '导出'
          return (
            <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 16, height: 56, padding: '0 18px', borderRadius: 12, marginBottom: 6, background: active ? ui.soft : 'transparent', color: active ? ui.brand : ui.text, fontSize: 22, fontWeight: active ? 700 : 500 }}>
              <span style={{ width: 22, height: 22, borderRadius: 6, border: `2.5px solid ${active ? ui.brand : '#A5ACB8'}` }} />
              {item}
            </div>
          )
        })}
      </div>
      <div style={{ ...place(APP.preview), borderRadius: 16, overflow: 'hidden', background: 'linear-gradient(135deg, #1D2433 0%, #28334A 55%, #3A4A6B 100%)' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '54px 54px' }} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: '#fff', paddingBottom: 60 }}>
          <div style={{ fontSize: 26, opacity: 0.6, letterSpacing: 2 }}>预览</div>
          <div style={{ fontSize: 72, fontWeight: 900 }}>示例画面</div>
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 44, display: 'flex', justifyContent: 'center', opacity: subtitles, transform: `translateY(${(1 - subtitles) * 10}px)` }}>
          <span style={{ padding: '8px 22px', borderRadius: 10, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 30, fontWeight: 600 }}>字幕会烧录进画面</span>
        </div>
      </div>
      <div style={{ position: 'absolute', left: px, top: py + ph + 14, width: pw, fontSize: 19, color: ui.dim, fontFamily: fonts.mono }}>ep1.mp4 · 1920 × 1080 · 30 fps</div>
      <div style={{ ...place(APP.progress), display: 'flex', alignItems: 'center', gap: 22, fontSize: 21 }}>
        <span style={{ color: ui.dim, flexShrink: 0 }}>导出进度</span>
        <div style={{ flex: 1, height: 12, borderRadius: 6, background: '#E3E7EE', overflow: 'hidden' }}>
          <div style={{ width: `${(exported ?? 0) * 100}%`, height: '100%', background: done ? '#22A06B' : ui.brand }} />
        </div>
        <span style={{ width: 90, textAlign: 'right', fontFamily: fonts.mono, color: done ? '#22A06B' : ui.text }}>{exported === undefined ? '—' : done ? '完成' : `${Math.floor(exported * 100)}%`}</span>
      </div>
      <div style={{ ...place(APP.panel), borderRadius: 18, background: ui.surface, border: `1px solid ${ui.border}` }} />
      <div style={{ position: 'absolute', left: 1484, top: 124, fontSize: 28, fontWeight: 800 }}>导出设置</div>
      <Label y={168}>分辨率</Label>
      <Field box={APP.resolution}>
        <span style={{ fontFamily: fonts.mono }}>1920 × 1080</span>
        <Chevron />
      </Field>
      <Label y={290}>帧率</Label>
      <Field box={APP.fps} style={{ padding: 5, gap: 5 }}>
        {['24', '30', '60'].map(v => (
          <span key={v} style={{ flex: 1, height: '100%', display: 'grid', placeItems: 'center', borderRadius: 8, fontFamily: fonts.mono, background: v === '30' ? ui.brand : 'transparent', color: v === '30' ? '#fff' : ui.text }}>
            {v}
          </span>
        ))}
      </Field>
      <Field box={APP.subtitles}>
        <span>烧录字幕</span>
      </Field>
      <div style={{ ...place(APP.toggle), borderRadius: th / 2, background: interpolateColors(subtitles, [0, 1], ['#CDD2DB', ui.brand]) }}>
        <div style={{ position: 'absolute', top: 3, left: 3 + subtitles * (tw - th), width: th - 6, height: th - 6, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }} />
      </div>
      <Label y={500} right={<span style={{ fontFamily: fonts.mono, color: ui.text }}>CRF {crf}</span>}>
        画质
      </Label>
      <div style={{ ...place([TRACK.x, TRACK.y, TRACK.w, 8]), borderRadius: 4, background: '#E3E7EE' }}>
        <div style={{ width: knobX(crf) - TRACK.x, height: '100%', borderRadius: 4, background: ui.brand }} />
      </div>
      <div style={{ position: 'absolute', left: knobX(crf) - 15, top: KNOB_Y - 15, width: 30, height: 30, borderRadius: '50%', background: '#fff', border: `3px solid ${ui.brand}`, boxSizing: 'border-box', boxShadow: '0 2px 6px rgba(0,0,0,0.18)' }} />
      <div style={{ position: 'absolute', left: TRACK.x, top: TRACK.y + 22, width: TRACK.w, display: 'flex', justifyContent: 'space-between', fontSize: 17, color: ui.dim }}>
        <span>文件小</span>
        <span>画质高</span>
      </div>
      <Label y={622}>音频</Label>
      <Field box={APP.audio}>
        <span style={{ fontFamily: fonts.mono }}>AAC · 320 kbps</span>
        <Chevron />
      </Field>
      <div style={{ ...place(APP.export), display: 'grid', placeItems: 'center', borderRadius: 14, background: done ? '#22A06B' : ui.brand, color: '#fff', fontSize: 26, fontWeight: 700 }}>
        {exported === undefined ? '开始导出' : done ? '已导出' : '导出中…'}
      </div>
    </div>
  )
}
