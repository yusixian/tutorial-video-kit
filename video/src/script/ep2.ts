import type { EpisodeScript } from './types'

export const ep2: EpisodeScript = {
  id: 'ep2',
  number: 2,
  title: '交付与投稿',
  subtitle: '检查成片、逐字稿和投稿素材',
  sections: {
    '2-1': '交付检查',
    '2-2': '逐字稿与投稿',
  },
  music: [{ track: 'demo-bed', scene: 'ep2-title' }],
  scenes: [
    {
      id: 'ep2-title',
      section: '2-0',
      title: '标题',
      lead: 0,
      minSeconds: 3.5,
      lines: [],
    },
    {
      id: 'ep2-check',
      section: '2-1',
      title: '交付检查',
      lines: [
        { id: 'ep2-check-01', text: '渲染完先做两遍响度归一，再跑交付检查。' },
        { id: 'ep2-check-02', text: '帧数、分辨率、色彩空间和音画同步，有一项对不上，就不算交付。', em: ['不算交付'] },
      ],
    },
    {
      id: 'ep2-publish',
      section: '2-2',
      title: '逐字稿与投稿',
      tail: 1.2,
      lines: [
        { id: 'ep2-publish-01', text: '逐字稿按句编号，每句配一张截图，改稿时说第几句就行。' },
        { id: 'ep2-publish-02', text: '投稿素材里的章节时间码，也是从同一条时间线算出来的。', em: ['同一条时间线'] },
        { id: 'ep2-publish-03', text: '把示例换成你自己的脚本和画面，就能开始做第一集了。' },
      ],
    },
  ],
}
