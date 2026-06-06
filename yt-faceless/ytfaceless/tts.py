"""ステージ2: 音声合成（ElevenLabs）+ タイムライン作成。

セクション単位で音声を生成し、各セクションの実測尺から
字幕（行単位）の表示タイミングを文字数比で割り当てる。
"""
from __future__ import annotations

import json
from pathlib import Path

import requests

from .config import Config
from .media import probe_duration, run

API_BASE = "https://api.elevenlabs.io/v1/text-to-speech"


def synthesize(cfg: Config, out_dir: Path) -> dict:
    if not cfg.elevenlabs_key:
        raise RuntimeError("ELEVENLABS_API_KEY が未設定です（.env を確認）")

    script = json.loads((out_dir / "script.json").read_text(encoding="utf-8"))
    voice_dir = out_dir / "voice"
    voice_dir.mkdir(exist_ok=True)

    tcfg = cfg.tts
    timeline: list[dict] = []
    cursor = 0.0
    section_files: list[Path] = []

    for sec in script["sections"]:
        narration = "。".join(line.rstrip("。") for line in sec["lines"]) + "。"
        mp3 = voice_dir / f"section_{sec['id']:03d}.mp3"
        _tts_request(cfg, narration, mp3)
        dur = probe_duration(mp3)
        section_files.append(mp3)

        # 行単位の字幕タイミングを文字数比で配分
        lines = sec["lines"]
        weights = [max(len(x), 1) for x in lines]
        total_w = sum(weights)
        sub_cursor = cursor
        sub_lines = []
        for line, w in zip(lines, weights):
            seg = dur * (w / total_w)
            sub_lines.append({"start": sub_cursor, "end": sub_cursor + seg, "text": line})
            sub_cursor += seg

        timeline.append({
            "id": sec["id"],
            "label": sec.get("label", "body"),
            "broll_query": sec.get("broll_query", ""),
            "start": cursor,
            "end": cursor + dur,
            "duration": dur,
            "subtitles": sub_lines,
        })
        cursor += dur
        print(f"  section {sec['id']:>2}: {dur:6.2f}s  [{sec.get('label','body')}] {sec.get('broll_query','')}")

    # セクション音声を結合して voice.mp3 を作る
    voice_path = out_dir / "voice.mp3"
    _concat_audio(section_files, voice_path, out_dir)

    tl = {"total_duration": cursor, "sections": timeline}
    (out_dir / "timeline.json").write_text(
        json.dumps(tl, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"  音声: {voice_path.name}  合計 {cursor:.1f}s")
    return tl


def _tts_request(cfg: Config, text: str, out_path: Path) -> None:
    tcfg = cfg.tts
    url = f"{API_BASE}/{tcfg['voice_id']}"
    headers = {
        "xi-api-key": cfg.elevenlabs_key,
        "accept": "audio/mpeg",
        "content-type": "application/json",
    }
    payload = {
        "text": text,
        "model_id": tcfg["model_id"],
        "voice_settings": {
            "stability": tcfg["stability"],
            "similarity_boost": tcfg["similarity_boost"],
        },
    }
    r = requests.post(url, headers=headers, json=payload, timeout=180)
    if r.status_code != 200:
        raise RuntimeError(f"ElevenLabs エラー {r.status_code}: {r.text[:500]}")
    out_path.write_bytes(r.content)


def _concat_audio(files: list[Path], out_path: Path, out_dir: Path) -> None:
    list_file = out_dir / "voice" / "concat.txt"
    list_file.write_text(
        "\n".join(f"file '{f.resolve()}'" for f in files), encoding="utf-8"
    )
    run([
        "ffmpeg", "-y", "-f", "concat", "-safe", "0",
        "-i", str(list_file), "-c", "copy", str(out_path),
    ])
