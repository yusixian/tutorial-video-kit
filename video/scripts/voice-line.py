"""Save one synthesis and its word boundaries from the same Edge TTS stream.

Usage: voice-line.py <text> <voice> <rate> <pitch> <audio.mp3> <metadata.jsonl>
"""
import asyncio
import sys

import edge_tts


async def main():
    text, voice, rate, pitch, audio, metadata = sys.argv[1:]
    await edge_tts.Communicate(
        text, voice, rate=rate, pitch=pitch, boundary="WordBoundary"
    ).save(audio, metadata)


asyncio.run(main())
