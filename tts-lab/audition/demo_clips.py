"""Makes two stand-in engines for `audition.example.json`: every case voiced by Edge TTS at the
original rate and at +30%, in `out/edge-normal/` and `out/edge-fast/`. Needs `uv` (for `uvx`).

    python3 demo_clips.py && python3 build_page.py
"""

import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent
VOICE = "zh-CN-XiaoxiaoNeural"
RATES = {"edge-normal": "+0%", "edge-fast": "+30%"}


def main():
    config = json.loads((ROOT / "audition.example.json").read_text())
    for engine in config["engines"]:
        folder = ROOT / engine["dir"]
        folder.mkdir(parents=True, exist_ok=True)
        for case in config["cases"]:
            clip = folder / f"{case['id']}.mp3"
            if clip.exists():
                continue
            subprocess.run(["uvx", "--from", "edge-tts>=7.2,<8", "edge-tts", "--voice", VOICE, f"--rate={RATES[engine['id']]}",
                            "--text", case["text"], "--write-media", str(clip)], check=True, capture_output=True)
            print(clip.relative_to(ROOT))


if __name__ == "__main__":
    main()
