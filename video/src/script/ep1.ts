import type { EpisodeScript } from './types'

export const ep1: EpisodeScript = {
  id: 'ep1',
  number: 1,
  title: '从脚本到成片',
  subtitle: '脚本、配音、时间线和画面怎么串起来',
  sections: {
    '1-1': '工作流',
    '1-2': '界面演示',
    '1-3': '配音与字幕',
  },
  music: [{ track: 'demo-bed', scene: 'ep1-title' }],
  scenes: [
    {
      id: 'ep1-title',
      section: '1-0',
      title: '标题',
      lead: 0,
      minSeconds: 3.5,
      lines: [],
    },
    {
      id: 'ep1-pipeline',
      section: '1-1',
      title: '五个步骤',
      lines: [
        { id: 'ep1-pipeline-01', text: '这套模板把一条教程视频拆成五步：写脚本、配音、排时间线、渲染，最后交付。' },
        { id: 'ep1-pipeline-02', text: '每一步都是一条命令，改了哪一步，就只重新跑哪一步。', pause: 0.4 },
        { id: 'ep1-pipeline-03', text: '配音按句缓存：没改过的台词，不会重新合成。', em: ['按句缓存'] },
      ],
    },
    {
      id: 'ep1-script',
      section: '1-1',
      title: '脚本即数据',
      lines: [
        { id: 'ep1-script-01', text: '脚本是一份数据：每句台词都有自己的 ID，字幕和配音都从这里取。', em: ['一份数据'] },
        { id: 'ep1-script-02', text: '时间线按每句配音的真实时长往后排，改一句台词，后面的画面会自动跟着挪。' },
        { id: 'ep1-script-03', text: '还没配音的时候，就按阅读速度估一个时长，照样能预览和渲染。' },
      ],
    },
    {
      id: 'ep1-panel',
      section: '1-2',
      title: '镜头、光标和聚光灯',
      tail: 1,
      lines: [
        { id: 'ep1-panel-01', text: '界面演示画在一张 1920×1080 的画布上，镜头可以推近到任意一块区域。' },
        { id: 'ep1-panel-02', text: '光标按距离决定移动快慢，点下去的时候，按钮也会跟着按下。', pause: 0.4 },
        { id: 'ep1-panel-03', text: '聚光灯会压暗其他地方；连着的两处高亮，会直接滑过去，不会一闪一闪。' },
        { id: 'ep1-panel-04', text: '这些动作都挂在台词的时间点上，配音变长变短，画面也会跟着走。' },
      ],
    },
    {
      id: 'ep1-voice',
      section: '1-3',
      title: '读法与重点',
      lines: [
        {
          id: 'ep1-voice-01',
          text: '字幕照写数字，配音另写读法：比如 1080p、30 fps 和 -15 LUFS。',
          tts: '字幕照写数字，配音另写读法：比如一零八零 P、三十帧每秒和负十五 LUFS。',
        },
        { id: 'ep1-voice-02', text: '多音字容易读错，比如「当成」，配音前会先换成同音字再合成。' },
        {
          id: 'ep1-voice-03',
          text: '想强调的词写进 em，字幕里就会换成强调色。',
          tts: '想强调的词写进 E M，字幕里就会换成强调色。',
          em: ['强调色'],
          pause: 0.5,
        },
      ],
    },
    {
      id: 'ep1-outro',
      section: '1-3',
      title: '下一集',
      tail: 1.2,
      lines: [
        { id: 'ep1-outro-01', text: '下一集讲交付：检查成片、生成逐字稿，再把投稿素材一次备齐。' },
        {
          id: 'ep1-outro-02',
          text: '现在跑一遍 pnpm studio，看看这一集是怎么拼起来的。',
          tts: '现在跑一遍 P N P M studio，看看这一集是怎么拼起来的。',
        },
      ],
    },
  ],
}
