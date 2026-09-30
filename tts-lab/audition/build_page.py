"""Builds a listening page for comparing TTS engines on the same lines.

    python3 build_page.py                  # page/index.html
    python3 build_page.py --pack           # also page/audition-packed.html, one file with the audio inside
    python3 build_page.py --config my.json

Needs Python 3.10+ and ffmpeg (with libmp3lame) on PATH; nothing else.

The config (`audition.json` next to this file, else `audition.example.json`) lists
- `cases`: `id`, `text` (the line) and `hint` (what to listen for);
- `engines`: `id`, `title`, `note` and `dir`, a folder holding one clip per case named
  `<case-id>.wav` (or `.mp3`, `.m4a`, `.flac`), relative to the config file;
- optional `title`, `intro`, `loudness` (target LUFS, default -18) and `key` (case ids compared
  side by side, default all).

Generate the clips with each engine however it runs (local model, web console, API), drop them in
the engine's folder and rerun; missing clips show as gaps. Every clip is loudness-matched with a
two-pass EBU R128 measurement and encoded to MP3, so engines are compared on voice rather than
volume. The page puts each key line side by side across engines, then gives every engine a
playlist of all its clips. `--pack` re-encodes the audio small and inlines it as base64, leaving
out missing clips, so the page can be sent to people without the folders.

`python3 demo_clips.py` makes two stand-in engines for the example config (Edge TTS at two rates).
"""

import argparse
import base64
import html
import json
import subprocess
from functools import cache
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PAGE = ROOT / "page"
EXTENSIONS = (".wav", ".mp3", ".m4a", ".flac")
GAP_SECONDS = 0.6


def measure(src: Path, target: float) -> dict:
    """First loudnorm pass: the clip's integrated loudness, true peak and range."""
    result = subprocess.run(
        ["ffmpeg", "-hide_banner", "-nostats", "-i", str(src), "-af", f"loudnorm=I={target}:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"],
        check=True, capture_output=True, text=True,
    )
    return json.loads(result.stderr[result.stderr.rindex("{"):result.stderr.rindex("}") + 1])


def encode(src: Path, dst: Path, target: float) -> Path:
    """Loudness-matched mono MP3, redone only when the source is newer."""
    if dst.exists() and dst.stat().st_mtime >= src.stat().st_mtime:
        return dst
    m = measure(src, target)
    linear = (f"loudnorm=I={target}:TP=-1.5:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}"
              f":measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
    dst.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-af", linear, "-ar", "48000", "-ac", "1",
                    "-c:a", "libmp3lame", "-b:a", "160k", str(dst)], check=True)
    return dst


def playlist(clips: list[Path], dst: Path) -> Path:
    """All of an engine's clips in case order with a short silence between them."""
    if dst.exists() and all(dst.stat().st_mtime >= c.stat().st_mtime for c in clips):
        return dst
    args = ["ffmpeg", "-v", "error", "-y"]
    for clip in clips:
        args += ["-i", str(clip), "-f", "lavfi", "-t", str(GAP_SECONDS), "-i", "anullsrc=r=48000:cl=mono"]
    n = len(clips) * 2 - 1
    args += ["-filter_complex", "".join(f"[{i}:a]" for i in range(n)) + f"concat=n={n}:v=0:a=1[a]",
             "-map", "[a]", "-c:a", "libmp3lame", "-b:a", "160k", str(dst)]
    subprocess.run(args, check=True)
    return dst


@cache
def inline(path: Path) -> str:
    """A small mono MP3 as a data URI, for the packed page."""
    mp3 = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-b:a", "64k", "-f", "mp3", "-"],
                         check=True, capture_output=True).stdout
    return "data:audio/mpeg;base64," + base64.b64encode(mp3).decode()


def find(folder: Path, case_id: str) -> Path | None:
    return next((p for p in (folder / f"{case_id}{ext}" for ext in EXTENSIONS) if p.exists()), None)


CSS = """
:root { color-scheme: dark; }
body { margin: 0; background: #111317; color: #f1f2f5; font: 16px/1.6 -apple-system, "PingFang SC", "Noto Sans SC", sans-serif; }
main { max-width: 62rem; margin: 0 auto; padding: 2.5rem 1.5rem 5rem; }
h1 { font-size: 1.8rem; margin: 0 0 .4rem; }
h2 { font-size: 1.2rem; margin: 2.75rem 0 .75rem; }
.meta, .note, .cell span, .missing { color: #979ca6; font-size: .9rem; }
.hint { color: #ffd27a; margin: 0 0 .6rem; font-size: .95rem; }
.line { border-top: 1px solid #262a31; padding: 1rem 0; }
.line h3 { font-size: 1.1rem; font-weight: 500; margin: 0 0 .2rem; }
.cells { display: grid; grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr)); gap: .5rem .75rem; }
.cell p { margin: .2rem 0 0; }
.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr)); gap: 1rem; }
.card { background: #1a1d23; border: 1px solid #2a2e36; border-radius: 10px; padding: 1rem; }
.card h3 { font-size: 1rem; margin: 0 0 .2rem; }
.card .note { margin: 0 0 .6rem; }
details summary { cursor: pointer; color: #979ca6; margin-top: .6rem; }
audio { width: 100%; height: 36px; }
"""


def build(config: dict, base: Path, packed: bool) -> str:
    """The page. `packed` inlines the audio, drops missing clips, and keeps only uncompared lines in the
    per-engine lists, so no clip is inlined twice."""
    target = float(config.get("loudness", -18))
    cases = {c["id"]: c for c in config["cases"]}
    key = config.get("key") or list(cases)
    unknown = [cid for cid in key if cid not in cases]
    if unknown:
        raise SystemExit(f"key lists unknown cases: {', '.join(unknown)}")
    engines = config["engines"]
    audio = PAGE / "audio" / f"{target:g}LUFS"
    clips: dict[tuple[str, str], Path] = {}
    for engine in engines:
        for cid in cases:
            src = find(base / engine["dir"], cid)
            if src:
                clips[engine["id"], cid] = encode(src, audio / engine["id"] / f"{cid}.mp3", target)

    def src_of(path: Path) -> str:
        return inline(path) if packed else path.relative_to(PAGE).as_posix()

    def player(engine: dict, cid: str, label: str) -> str:
        clip = clips.get((engine["id"], cid))
        if clip:
            return f'<div class="cell"><span>{html.escape(label)}</span><audio controls preload="none" src="{src_of(clip)}"></audio></div>'
        if packed:
            return ""
        return f'<div class="cell"><span>{html.escape(label)}</span><p class="missing">缺少 {html.escape(engine["dir"])}/{html.escape(cid)}.wav</p></div>'

    rows = "".join(
        f'<section class="line"><h3>{html.escape(cases[cid]["text"])}</h3>'
        + (f'<p class="hint">{html.escape(cases[cid]["hint"])}</p>' if cases[cid].get("hint") else "")
        + f'<div class="cells">{"".join(player(e, cid, e["title"]) for e in engines)}</div></section>'
        for cid in key
    )
    cards = []
    for engine in engines:
        own = [clips[engine["id"], cid] for cid in cases if (engine["id"], cid) in clips]
        if not own and packed:
            continue
        body = (f'<audio controls preload="none" src="{src_of(playlist(own, audio / engine["id"] / "_all.mp3"))}"></audio>'
                if own else '<p class="missing">还没有片段</p>')
        each = "".join(player(engine, cid, cases[cid]["text"]) for cid in cases if not packed or cid not in key)
        details = f'<details><summary>逐句</summary><div>{each}</div></details>' if each else ""
        cards.append(f'<section class="card"><h3>{html.escape(engine["title"])}</h3><p class="note">{html.escape(engine.get("note", ""))}'
                     f'（{len(own)}/{len(cases)} 句）</p>{body}{details}</section>')
    title = config.get("title", "配音试听")
    return f"""<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)}</title><style>{CSS}</style></head><body><main>
<h1>{html.escape(title)}</h1>
<p class="meta">{html.escape(config.get("intro", ""))}响度统一到 {target:g} LUFS，{len(engines)} 个引擎，{len(cases)} 句。</p>
<h2>逐句对比</h2>{rows}
<h2>按引擎连播</h2><div class="cards">{"".join(cards)}</div>
</main></body></html>"""


def main():
    parser = argparse.ArgumentParser(description="Build the TTS listening page.")
    parser.add_argument("--config", type=Path, help="config JSON (default: audition.json, else audition.example.json)")
    parser.add_argument("--pack", action="store_true", help="also write page/audition-packed.html with the audio inlined")
    args = parser.parse_args()
    config_path = args.config or (ROOT / "audition.json" if (ROOT / "audition.json").exists() else ROOT / "audition.example.json")
    config = json.loads(config_path.read_text())
    base = config_path.resolve().parent
    PAGE.mkdir(exist_ok=True)
    (PAGE / "index.html").write_text(build(config, base, packed=False))
    found = sum(1 for e in config["engines"] for c in config["cases"] if find(base / e["dir"], c["id"]))
    print(f"{found}/{len(config['engines']) * len(config['cases'])} clips -> {PAGE / 'index.html'}")
    if args.pack:
        target = PAGE / "audition-packed.html"
        target.write_text(build(config, base, packed=True))
        print(f"{inline.cache_info().currsize} clips inlined -> {target} ({target.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
