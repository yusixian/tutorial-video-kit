/** Upload metadata per episode for `publish.ts`. Every link here is a placeholder: replace them before publishing. */

export type Kit = {
  title: string
  intro: string
  tags: string[]
  /** Links for this episode; defaults to `LINKS.docs`. */
  docs?: [name: string, url: string][]
  /** Where the on-screen material comes from, printed under 【素材】. */
  source?: string
}

/** Example values: `publish.ts` warns while any of them still points at example.com. */
export const LINKS = {
  /** Download page for the episode materials. */
  materials: 'https://example.com/materials',
  /** Invite to the viewers' discussion group. */
  community: 'https://example.com/community',
  /** Reference pages listed under 【相关链接】 unless an episode lists its own. */
  docs: [
    ['项目主页', 'https://example.com'],
    ['使用文档', 'https://example.com/docs'],
  ] as [string, string][],
}

export const KITS: Record<string, Kit> = {
  ep1: {
    title: '【教程视频工作流 EP1】从脚本到成片：脚本、配音、时间线和画面怎么串起来',
    intro: '第一集把整条流程走一遍：脚本写成数据，每句台词逐句配音、按句缓存；时间线按配音的真实时长排好，界面演示用镜头推近、光标点击和聚光灯；最后讲字幕和配音怎么分开写，多音字怎么处理。',
    tags: ['教程', '视频制作', 'Remotion', '自动化', 'TTS', '字幕', '工作流', '效率工具'],
  },
  ep2: {
    title: '【教程视频工作流 EP2】交付与投稿：交付检查、逐字稿和投稿素材',
    intro: '第二集讲交付：渲染后先做两遍响度归一，再逐项跑交付检查；逐字稿按句编号、配上截图，方便改稿；投稿用的标题、简介和章节时间码，也从同一条时间线自动生成。',
    tags: ['教程', '视频制作', 'Remotion', '自动化', '逐字稿', '投稿', '工作流', '效率工具'],
  },
}

/** The compilation of all episodes; its chapters list every episode and section. */
export const COMPILATION: Kit = {
  title: '【教程视频工作流】从脚本到投稿，一条命令一步（合集）',
  intro: '把全部分集合成一条一次看完：脚本即数据、逐句配音、按配音排时间线、界面演示、交付检查、逐字稿和投稿素材。章节目录见置顶评论，也可以直接看分集。',
  tags: ['教程', '视频制作', 'Remotion', '自动化', 'TTS', '字幕', '工作流', '合集'],
}
