/**
 * Synthesizes the UI sound effects and the demo music bed as 48 kHz mono WAVs in
 * `public/audio/sfx/`: `pnpm sfx`. Everything comes from oscillators and seeded
 * noise, so the sounds are reproducible and carry no licensing constraints.
 */
import fs from 'node:fs/promises'
import path from 'node:path'

const RATE = 48_000
const OUT_DIR = path.resolve(import.meta.dirname, '../public/audio/sfx')

const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0
  return seed / 2 ** 32
}

const buffer = (seconds: number) => new Float32Array(Math.ceil(seconds * RATE))

/** RBJ biquad band-pass, constant 0 dB peak gain. */
function bandPass(input: Float32Array, freqAt: (i: number) => number, q: number) {
  const out = new Float32Array(input.length)
  let x1 = 0
  let x2 = 0
  let y1 = 0
  let y2 = 0
  for (let i = 0; i < input.length; i++) {
    const w0 = (2 * Math.PI * freqAt(i)) / RATE
    const alpha = Math.sin(w0) / (2 * q)
    const a0 = 1 + alpha
    const b0 = alpha / a0
    const b2 = -alpha / a0
    const a1 = (-2 * Math.cos(w0)) / a0
    const a2 = (1 - alpha) / a0
    const x0 = input[i]
    const y0 = b0 * x0 + b2 * x2 - a1 * y1 - a2 * y2
    out[i] = y0
    x2 = x1
    x1 = x0
    y2 = y1
    y1 = y0
  }
  return out
}

const normalize = (samples: Float32Array, peak = 0.8) => {
  let max = 0
  for (const s of samples) max = Math.max(max, Math.abs(s))
  if (max > 0) for (let i = 0; i < samples.length; i++) samples[i] *= peak / max
  return samples
}

/** Short fades so no clip starts or ends on a non-zero sample. */
const declick = (samples: Float32Array, fadeMs = 3) => {
  const n = Math.floor((fadeMs / 1000) * RATE)
  for (let i = 0; i < n && i < samples.length; i++) {
    samples[i] *= i / n
    samples[samples.length - 1 - i] *= i / n
  }
  return samples
}

function click() {
  const s = buffer(0.06)
  const rand = seeded(7)
  for (let i = 0; i < s.length; i++) {
    const t = i / RATE
    const body = Math.sin(2 * Math.PI * 1850 * t) * Math.exp(-t * 90)
    const tick = t < 0.004 ? (rand() * 2 - 1) * (1 - t / 0.004) : 0
    s[i] = body * 0.7 + tick * 0.5
  }
  return declick(normalize(s, 0.55), 1)
}

function pop() {
  const s = buffer(0.14)
  let phase = 0
  for (let i = 0; i < s.length; i++) {
    const t = i / RATE
    const freq = 520 + 700 * Math.min(1, t / 0.05)
    phase += (2 * Math.PI * freq) / RATE
    s[i] = Math.sin(phase) * Math.exp(-t * 32) * Math.min(1, t / 0.004)
  }
  return declick(normalize(s, 0.6))
}

function whoosh(seconds = 0.7) {
  const s = buffer(seconds)
  const rand = seeded(42)
  const noise = s.map(() => rand() * 2 - 1)
  const swept = bandPass(noise, i => 300 + 3200 * Math.sin((Math.PI * i) / s.length), 0.9)
  for (let i = 0; i < s.length; i++) {
    const x = i / s.length
    s[i] = swept[i] * Math.sin(Math.PI * x) ** 2
  }
  return declick(normalize(s, 0.6))
}

function chime() {
  const s = buffer(0.9)
  const partials = [
    [1318.5, 1],
    [1975.5, 0.55],
    [2637, 0.25],
  ]
  for (let i = 0; i < s.length; i++) {
    const t = i / RATE
    let v = 0
    for (const [f, a] of partials) v += a * Math.sin(2 * Math.PI * f * t) * Math.exp(-t * (3.2 + f / 1200))
    s[i] = v * Math.min(1, t / 0.003)
  }
  return declick(normalize(s, 0.45))
}

/**
 * Four soft sustained chords as a 16-second loop. Each chord's envelope and phase run on its own
 * clock taken modulo the loop, so the last chord's release carries straight into the first bar.
 */
function bed() {
  const loop = 16
  const s = buffer(loop)
  const chords = [
    [261.63, 329.63, 392.0, 493.88],
    [220.0, 261.63, 329.63, 392.0],
    [174.61, 220.0, 261.63, 329.63],
    [196.0, 246.94, 293.66, 392.0],
  ]
  const hold = loop / chords.length
  const attack = 1.2
  const release = 2
  for (let i = 0; i < s.length; i++) {
    const t = i / RATE
    let v = 0
    chords.forEach((notes, k) => {
      const local = (t - k * hold + loop) % loop
      if (local > hold + release) return
      const env = Math.min(1, local / attack) * (local > hold ? 1 - (local - hold) / release : 1)
      const voice = (f: number) => Math.sin(2 * Math.PI * f * local) + 0.5 * Math.sin(2 * Math.PI * f * 1.003 * local) + 0.18 * Math.sin(4 * Math.PI * f * local)
      v += env * (notes.reduce((sum, f) => sum + voice(f), 0) + 0.8 * Math.sin(Math.PI * notes[0] * local))
    })
    s[i] = v
  }
  return normalize(s, 0.35)
}

function toWav(samples: Float32Array) {
  const data = Buffer.alloc(samples.length * 2)
  samples.forEach((v, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), i * 2))
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + data.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(RATE, 24)
  header.writeUInt32LE(RATE * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(data.length, 40)
  return Buffer.concat([header, data])
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true })
  const sounds: Record<string, Float32Array> = { click: click(), pop: pop(), whoosh: whoosh(), chime: chime(), 'demo-bed': bed() }
  for (const [name, samples] of Object.entries(sounds)) await fs.writeFile(path.join(OUT_DIR, `${name}.wav`), toWav(samples))
  console.log(`wrote ${Object.keys(sounds).join(', ')} to ${path.relative(process.cwd(), OUT_DIR)}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
