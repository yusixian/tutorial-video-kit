# 工作流

从起手到发布的完整顺序。命令都在 `video/` 下运行，输出写到仓库根目录的 `out/`、`transcript/`、`publish/`、`voice/`。

## 0. 起手

1. 用 [`prompts/01-kickoff.md`](../prompts/01-kickoff.md) 的提示词开第一个会话。
2. 让 agent 先写需求文档（参考片拆解、受众、风格、分集和逐句脚本、素材、制作方案、里程碑），再写 `GOAL.md`（[模板](../templates/GOAL.md)），第一轮只交前两集。
3. 资料放进 `research/`：官方文档摘要、线上页面实测、截图。口播里的每个事实都要能在这里找到出处。

## 1. 写台词

台词写在 `video/src/script/ep*.ts`：

```ts
export const ep1: EpisodeScript = {
  id: 'ep1',
  number: 1,
  title: '……',
  subtitle: '……',
  sections: { '1-1': '……', '1-2': '……' },
  music: [],
  scenes: [
    {
      id: 'ep1-intro',
      section: '1-1',
      title: '开场',
      lines: [
        { id: 'ep1-intro-01', text: '字幕原文', em: ['高亮的词'] },
        { id: 'ep1-intro-02', text: '价格是 9.99 美元。', tts: '价格是九点九九美元。', pause: 0.5 },
      ],
    },
  ],
}
```

- 句子 `id` 全系列唯一，逐字稿、修改记录、提词稿都用它定位。
- `text` 是字幕；念法不同才写 `tts`。统一的读音规则放进 `scripts/spoken-text.ts`（见 [读音修正](pronunciation.md)）。
- 场景的 `lead`、`tail`、`minSeconds` 控制首尾留白和最短时长；没有台词的场景（片头、作品过场）用 `minSeconds` 撑开。

## 2. 配音

```sh
pnpm tts
```

- 逐句调用 Edge TTS（`uvx --from edge-tts`），同一个请求里拿到逐词时间戳。
- 按「念法文本 + 声音 + 语速 + 音高」缓存，只有改过的句子会重新合成。
- 结果写进 `src/script/tts-manifest.json`：每句的音频文件、时长、逐词时间戳。
- 声音和语速在 `src/script/voice.ts`。换引擎时保持 manifest 格式不变，视频这边不用改（见 [TTS 选型](tts-selection.md)）。

查看时间轴：

```sh
pnpm timing ep1
```

## 3. 画面

- 每个场景一个组件，放在 `src/scenes/<ep>/`，在该集的 `index.ts` 里按场景 id 注册；新的一集还要把注册表加进 `src/episode/entries.ts`。
- 组件里用 `useScene()` 拿到本场景每句的起止帧：`L(i)` 是第 i 句开始，`E(i)` 是结束。
- 要在某个词念到时出现，用 `cueTextFrame(line, '词')`；换了配音也会自动对齐。
- 教程界面用普通 JSX 做一个假的页面，放进 `Stage`：镜头按关键帧推拉，光标按距离走弧线、点击有按下反馈（`clickAt`）、能拖动（`drag`），聚光框在控件之间滑动。控件坐标写成常量，示例见 `src/scenes/ep1/app.tsx`。
- 场景在同一小节内淡入淡出，换小节时像翻页；标题会叠在一起的场景设 `dip: true`，先淡出再淡入。

预览：

```sh
pnpm studio
```

先出静帧和短片段给人看，确认了再全量渲。

## 4. 渲染和检查

```sh
pnpm render ep1 ep2 --concurrency 4   # 不写集名就渲全部 → out/raw/<ep>.mp4
pnpm finalize                         # 两遍 loudnorm → out/<ep>.mp4（-15 LUFS / -1 dBTP），也可以只写集名
pnpm compilation                      # 拼合集 → out/compilation.mp4
pnpm delivery-check                   # 帧数、分辨率、帧率、编码、色彩、音频、音画时长、完整解码
pnpm covers                           # 封面静帧 → out/covers/
```

- 一次只跑一个渲染。
- `pnpm delivery-check --timing-only` 只检查时间轴：句子 id 唯一、口播不超出场景、句子不重叠、字幕块不短于 1.2 秒。
- 检查通过只说明文件没问题，人还要从头看一遍、听一遍。

渲染慢的原因和提速办法见 [渲染提速](render-performance.md)。

## 5. 逐字稿和改稿

```sh
pnpm transcript                 # transcript/<ep>.md + 每句截图
pnpm transcript:lark pull       # 先拉回评论和改字
pnpm transcript:lark push       # 再重建飞书文档
```

改稿循环见 [逐字稿](transcript.md)。

## 6. 发布

```sh
pnpm publish-kit     # publish/<ep>.md、publish/compilation.md
pnpm prompter        # voice/ 下的提词稿，想自己录配音时用
```

标题、简介、标签、链接在 `scripts/kits.ts`，发布清单见 [发布](publishing.md)。

## 7. 换配音（最后做）

内容定稿后再换声音：

1. 挑 4 句覆盖所有痛点的关键句，每个候选引擎念一遍，用 `tts-lab/audition/build_page.py` 做并排试听页（先跑 `demo_clips.py` 看一下示例）；
2. 选定后先配一整集试听；
3. 全量生成时保持 manifest 格式，装进 `video/` 之前人先试听；
4. 全片时长会变，重跑 `pnpm timing`、渲染、`pnpm transcript`、`pnpm publish-kit`。

## 多个会话并行

规矩和交接模板见 [多会话协作](multi-agent.md)。
