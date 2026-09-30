# tutorial-video-kit

用 AI coding agent（Claude Code、Codex 这类）加 [Remotion](https://www.remotion.dev/) 做长篇、分集的软件教程视频的模板。

它来自一套 46 分钟、9 集的中文教程的实际工程，保留了那套工程的架构和流程，去掉了所有和原产品相关的画面、素材和链接。做这套教程的完整复盘：[复盘：和 AI 一起做完一套 46 分钟的 PixAI 教程](https://blog.cosine.ren/post/pixai-tutorial-retrospective)。

## 里面有什么

| 目录 | 内容 |
| --- | --- |
| [`video/`](video/) | 能跑的 Remotion 工程，带两集示例：台词数据、Edge 配音和缓存、按配音时长算的时间轴、字幕对齐、镜头和聚光框、响度归一、交付检查、逐字稿（本地版和飞书版）、B 站投稿文案、提词稿 |
| [`tts-lab/audition/`](tts-lab/audition/) | TTS 试听台：把多个引擎念的同一批句子做成并排试听页，统一响度，还能打包成单个 HTML 发给别人 |
| [`prompts/`](prompts/) | 起手、改片、逐字稿、配音、交接、发布各阶段的提示词 |
| [`templates/`](templates/) | `GOAL.md`、`HANDOFF.md`、`COORDINATION.md` 模板 |
| [`docs/`](docs/) | 流程和踩过的坑：[工作流](docs/workflow.md)、[逐字稿](docs/transcript.md)、[读音修正](docs/pronunciation.md)、[TTS 选型](docs/tts-selection.md)、[渲染提速](docs/render-performance.md)、[多会话协作](docs/multi-agent.md)、[发布清单](docs/publishing.md) |

## 核心思路

**台词是唯一的数据源，其他东西都从它算出来。**

```text
video/src/script/ep*.ts ──► pnpm tts ──► tts-manifest.json（每句时长 + 逐词时间戳）
        │                                      │
        └──────────────► timeline.ts ◄─────────┘
                              │
        ┌─────────────┬───────┴──────┬──────────────┬──────────────┐
        ▼             ▼              ▼              ▼              ▼
   Remotion 分集   字幕切块     顶栏和章节进度   投稿章节目录     逐字稿时间码
```

- 每句台词有全系列唯一的 `id`；`text` 是字幕，`tts` 是和字幕不同时的念法。
- 配完音，每句的时长决定场景长度；改一句台词，后面所有时间码自动跟着变。
- 场景组件用 `useScene()` 拿到每句的起止帧，用 `cueTextFrame()` 找到某个词念到的那一帧，画面跟着口播走。

## 快速开始

需要：Node 22+、pnpm 10、ffmpeg 5.1 以上（逐字稿截图用到 `-fps_mode`；试听台要带 libmp3lame）、[uv](https://docs.astral.sh/uv/)（跑 edge-tts）、ImageMagick 7 的 `magick`（逐字稿拼图）。画面用系统字体，macOS 自带苹方；想在不同机器上出一样的画面，装上 Noto Sans SC。第一次渲染时 Remotion 会自动下载 Chrome Headless Shell（约 94 MB）。

```sh
cd video
pnpm install                   # 装依赖，顺带用代码合成示例音效和配乐（pnpm sfx）
pnpm typecheck && pnpm test    # 类型检查；字幕切块和时间轴的单元测试
pnpm studio                    # 在 Remotion Studio 里预览
pnpm timing ep1                # 打印每个场景、每句话的时间码
pnpm tts                       # 用 Edge TTS 给示例台词配音（会把示例台词发给微软的服务）
pnpm delivery-check --timing-only
pnpm render --concurrency 4    # 渲染全部分集 → out/raw/<ep>.mp4，也可以只写 ep1 ep2
pnpm finalize                  # 两遍 loudnorm 到 -15 LUFS → out/<ep>.mp4
pnpm compilation               # 按顺序拼成合集 → out/compilation.mp4
pnpm delivery-check            # 帧数、编码、色彩、音画时长、完整解码
pnpm covers                    # 封面 → out/covers/
pnpm transcript                # 逐字稿和每句截图 → transcript/
pnpm publish-kit               # 投稿文案 → publish/
pnpm prompter                  # 提词稿 → voice/（加 --pdf 用本机 Chrome 出 PDF）
pnpm transcript:lark push      # 可选：推送飞书逐字稿，需要先登录 lark-cli
```

不跑 `pnpm tts` 也能预览和渲染，时间轴会按阅读速度估算每句时长，只是没有声音。`pnpm render` 会先检查清单里登记过的配音、配乐和音效文件，缺了会提示该跑什么命令；还没配音的句子会渲成无声，终端会提醒。配音音频不进 git，克隆下来的清单是空的 `{}`。

试听台：

```sh
cd tts-lab/audition
python3 demo_clips.py          # 用 Edge TTS 以两种语速生成两个示例「引擎」
python3 build_page.py --pack   # page/index.html，加 --pack 再出一个内嵌音频的单文件 HTML
```

换成自己的候选引擎：复制 `audition.example.json` 为 `audition.json`，写好句子、要听的点和每个引擎的音频目录，把各引擎念好的 `<句子 id>.wav` 放进去再运行。

## 换成自己的内容

1. `video/src/config.ts`：系列名、版本标记、语言、飞书逐字稿的标题。
2. `video/src/script/`：照着 `ep1.ts` 写自己的分集，在 `episodes.ts` 里登记。
3. `video/src/scenes/`：每个场景一个组件，在该集的 `index.ts` 里按场景 id 注册（逐字稿读这个文件，找出每个场景由哪个组件、哪个文件负责），再把注册表加进 `src/episode/entries.ts`（Remotion 合成用）。界面演示照着 `scenes/ep1/app.tsx` 用 JSX 画一个假的页面，控件坐标写成常量，给镜头、光标和聚光框用。
4. `video/scripts/spoken-text.ts`：你的多音字和缩写读法。
5. `video/scripts/kits.ts`：投稿标题、简介、标签、链接（示例是 `example.com` 占位，没换完之前 `pnpm publish-kit` 会在发布检查里提醒）。
6. `video/src/script/music.ts`：配乐文件和署名。示例配乐是代码合成的，换成有授权的曲子放进 `public/audio/bgm/`（这个目录默认不进 git，多数曲库不允许再分发）。
7. 用 [`prompts/01-kickoff.md`](prompts/01-kickoff.md) 的提示词起手，让 agent 先写需求文档和 `GOAL.md`。

## 许可

本仓库的代码和文档使用 [MIT](LICENSE)。

依赖的 Remotion 有自己的许可证，不是 MIT：个人（包括商用）、雇员不超过 3 人的营利性组织、非营利组织可以免费用；人数按整个组织算，大公司里的三人小组也不算。其他营利性组织需要购买公司授权，见 [Remotion 许可证说明](https://www.remotion.dev/docs/license/faq)。

示例里没有第三方素材，音效和配乐都是代码合成的。你自己放进去的图片、音乐、字体和声音，按它们各自的授权使用；配音用了谁的声音、用的哪家 TTS，也要看对应的条款（见 [TTS 选型](docs/tts-selection.md#授权和标注)）。
