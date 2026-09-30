/** Everything that names the series; change these to rebrand the video chrome, covers, transcript and upload kits. */
export const config = {
  /** Shown in the top bar, on covers and as the transcript heading. */
  series: '教程视频工作流',
  /** Version tag beside the series title, e.g. the month the recorded UI dates from. */
  version: '2026.09',
  /** Subtitle chunking and the reading-speed estimate follow this; the voice lives in `script/voice.ts`. */
  locale: 'zh' as 'zh' | 'en',
  /** Title of the Lark copy of the transcript (`pnpm transcript:lark push`). */
  larkTitle: '教程视频工作流 · 逐字稿与画面（带时间码）',
}
