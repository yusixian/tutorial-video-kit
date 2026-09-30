/** Spellings a human narrator reads out too, so the recording prompter shows them as said. Rules that only delete come first. */
export const READINGS: [pattern: RegExp, reading: string][] = [
  [/[「」『』]/g, ''],
  [/×/g, '乘'],
  [/(\d)\s*[~～]\s*(?=\d)/g, '$1到'],
]

export const readingText = (text: string) => READINGS.reduce((result, [pattern, reading]) => result.replace(pattern, reading), text)

/**
 * Polyphones have to be checked by ear rather than trusted to the voice. edge-tts escapes SSML,
 * so each one is pinned with a same-sounding character instead of `<phoneme>`; every swap keeps
 * the length, so the prompter can still mark the original character with its pinyin.
 */
export const pinPolyphones = (text: string) =>
  text
    .replace(/重(绘|抽|画|用)/g, '虫$1')
    .replace(/载(入|进)/g, '在$1')
    .replace(/(?<![色基冷强格语])调(色盘|画风|到|细节|参数|的|整)/g, '条$1')
    .replace(/微调/g, '微条')
    .replace(/当(需求|清单|成)/g, '荡$1')

/** Pinyin shown in the prompter for each pinned stand-in character. */
export const PINYIN: Record<string, string> = { 虫: 'chóng', 在: 'zài', 条: 'tiáo', 荡: 'dàng' }

/** What the TTS engine is given for a line: `tts ?? text` with readings applied and polyphones pinned. */
export const spokenText = (text: string) => pinPolyphones(readingText(text))
