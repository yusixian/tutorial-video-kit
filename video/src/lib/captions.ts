export type SpeechWord = { text: string; from: number; to: number }
export type SpeechTiming = { text: string; words: SpeechWord[] }
export type SubtitleCue = { from: number; duration: number; text: string; em?: string[]; speech?: SpeechTiming }

const MAX_CHARS = 24
const MIN_FRAMES = 36
const letters = (text: string) => [...text.toLowerCase()].filter(c => /[\p{L}\p{N}]/u.test(c))

/** Map display-text boundaries to spoken text, including number and pronunciation overrides. */
const alignBoundaries = (display: string[], spoken: string[]): number[] => {
  const costs = Array.from({ length: display.length + 1 }, () => new Uint16Array(spoken.length + 1))
  for (let i = 0; i <= display.length; i++) costs[i][0] = i
  for (let j = 0; j <= spoken.length; j++) costs[0][j] = j
  for (let i = 1; i <= display.length; i++) {
    for (let j = 1; j <= spoken.length; j++) {
      costs[i][j] = Math.min(costs[i - 1][j] + 1, costs[i][j - 1] + 1, costs[i - 1][j - 1] + Number(display[i - 1] !== spoken[j - 1]))
    }
  }
  const boundaries = new Array<number>(display.length + 1)
  let i = display.length
  let j = spoken.length
  boundaries[i] = j
  while (i || j) {
    if (i && j && costs[i][j] === costs[i - 1][j - 1] + Number(display[i - 1] !== spoken[j - 1])) {
      i--
      j--
    } else if (i && costs[i][j] === costs[i - 1][j] + 1) {
      i--
    } else {
      j--
    }
    boundaries[i] = j
  }
  return boundaries
}

const speechFrames = (speech: SpeechTiming, fps: number) => {
  const frames: number[] = []
  for (const word of speech.words) {
    const chars = letters(word.text)
    chars.forEach((_, i) => frames.push(Math.round((word.from + (word.to - word.from) * i / chars.length) * fps)))
  }
  frames.push(Math.round((speech.words.at(-1)?.to ?? 0) * fps))
  return frames
}

const textTiming = (cue: SubtitleCue, fps: number) => {
  const display = letters(cue.text)
  const spoken = cue.speech && letters(cue.speech.text)
  const aligned = spoken && alignBoundaries(display, spoken)
  const frames = cue.speech && speechFrames(cue.speech, fps)
  return (prefix: string) => {
    const n = letters(prefix).length
    const frame = aligned && frames ? frames[aligned[n]] : Math.round(cue.duration * n / Math.max(1, display.length))
    return Math.max(0, Math.min(cue.duration, frame ?? 0))
  }
}

/** Frame where a quoted phrase starts, for narration-synchronized callouts. */
export const cueTextFrame = (cue: SubtitleCue, phrase: string, fps = 30) => {
  const index = cue.text.indexOf(phrase)
  if (index < 0) throw new Error(`phrase is absent from narration: ${phrase}`)
  return cue.from + textTiming(cue, fps)(cue.text.slice(0, index))
}

/** Split at punctuation, retain quoted text, and merge cues too brief to read. */
export const chunkCue = (cue: SubtitleCue, fps = 30, locale: 'zh' | 'en' = 'zh'): SubtitleCue[] => {
  if (locale === 'en') return chunkEnglishCue(cue, fps)
  const pieces = cue.text.match(/(?:「[^」]*」?|[^，。；：！？、,;「])+[，。；：！？、,;]?/g) ?? [cue.text]
  const chunks: string[] = []
  for (const piece of pieces) {
    const last = chunks.at(-1)
    if (last !== undefined && [...last, ...piece].length <= MAX_CHARS) chunks[chunks.length - 1] += piece
    else chunks.push(piece)
  }
  const at = textTiming(cue, fps)
  const starts = () => chunks.map((_, i) => i === 0 ? 0 : at(chunks.slice(0, i).join('')))
  while (chunks.length > 1) {
    const boundaries = [...starts(), cue.duration]
    const short = chunks.findIndex((_, i) => boundaries[i + 1] - boundaries[i] < MIN_FRAMES * fps / 30)
    if (short < 0) break
    const previous = short > 0 && (short === chunks.length - 1 || chunks[short - 1].length <= chunks[short + 1].length)
    const index = previous ? short - 1 : short
    chunks.splice(index, 2, chunks[index] + chunks[index + 1])
  }
  const boundaries = [...starts(), cue.duration]
  return chunks.map((text, i) => ({
    from: cue.from + boundaries[i],
    duration: boundaries[i + 1] - boundaries[i],
    text: text.replace(/[，、,;；]$/, ''),
    em: cue.em,
  }))
}

/** English wraps at whole words; offsets still come from the same synthesis as the audio. */
const chunkEnglishCue = (cue: SubtitleCue, fps: number): SubtitleCue[] => {
  const words = [...cue.text.matchAll(/\S+/g)]
  if (!words.length) return []
  const groups: { start: number; end: number }[] = []
  let start = words[0].index
  for (let i = 0; i < words.length; i++) {
    const word = words[i]
    let end = word.index + word[0].length
    const next = words[i + 1]
    const sentenceEnd = /[.!?]["”']?$/.test(word[0]) && end - start >= 28
    const overflow = next && next.index + next[0].length - start > 68
    if (!next || overflow || sentenceEnd) {
      if (overflow && !sentenceEnd) {
        // Prefer a complete clause or list item to splitting a phrase at the length limit.
        for (let j = i; j >= 0 && words[j].index >= start; j--) {
          const candidate = words[j]
          const candidateEnd = candidate.index + candidate[0].length
          if (/[,;:]$/.test(candidate[0]) && candidateEnd - start >= 24) {
            end = candidateEnd
            i = j
            break
          }
        }
      }
      groups.push({ start, end })
      start = words[i + 1]?.index ?? end
    }
  }
  const at = textTiming(cue, fps)
  // Balance a short tail instead of flashing an isolated final word.
  if (groups.length > 1) {
    const last = groups.at(-1)!
    const previous = groups.at(-2)!
    if (last.end - last.start < 20) {
      if (last.end - previous.start <= 68) {
        previous.end = last.end
        groups.pop()
      } else {
        const middle = (previous.start + last.end) / 2
        const candidates = words.filter(word => word.index - previous.start >= 20 && word.index - previous.start <= 68 && last.end - word.index >= 20 && last.end - word.index <= 68)
        const score = (word: (typeof words)[number]) => {
          const preceding = cue.text.slice(previous.start, word.index).trimEnd().split(/\s+/).at(-1)!
          return Math.abs(word.index - middle) + (/^(a|an|the|of|to|in|with|for|and|or)$/i.test(preceding) ? 30 : 0) - (/[,;:]$/.test(preceding) ? 20 : 0)
        }
        const split = candidates.reduce<(typeof words)[number] | undefined>((best, word) => !best || score(word) < score(best) ? word : best, undefined)
        if (split) {
          previous.end = cue.text.slice(0, split.index).trimEnd().length
          last.start = split.index
        }
      }
    }
  }
  const starts = groups.map((group, i) => i ? at(cue.text.slice(0, group.start)) : 0)
  return groups.map((group, i) => ({
    from: cue.from + starts[i],
    duration: (starts[i + 1] ?? cue.duration) - starts[i],
    text: cue.text.slice(group.start, group.end),
    em: cue.em,
  })).filter(chunk => chunk.duration > 0)
}
