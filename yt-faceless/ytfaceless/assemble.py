"""ステージ4: 動画の組み立て（FFmpeg）。

各セクションごとに尺ぴったりの映像クリップを作り、結合してから
ナレーション音声を乗せ、字幕を焼き込む。
"""
from __future__ import annotations

import json
from pathlib import Path

from .config import Config
from .media import ensure_ffmpeg, run


def assemble(cfg: Config, out_dir: Path) -> Path:
    ensure_ffmpeg()
    timeline = json.loads((out_dir / "timeline.json").read_text(encoding="utf-8"))
    assets = json.loads((out_dir / "assets.json").read_text(encoding="utf-8"))

    vcfg = cfg.video
    w, h, fps = vcfg["width"], vcfg["height"], vcfg["fps"]
    bg = "0x" + vcfg["background_color"].lstrip("#")

    clips_dir = out_dir / "clips"
    clips_dir.mkdir(exist_ok=True)
    clip_paths: list[Path] = []

    vf_fit = (
        f"scale={w}:{h}:force_original_aspect_ratio=increase,"
        f"crop={w}:{h},fps={fps},format=yuv420p"
    )

    for sec in timeline["sections"]:
        sid = sec["id"]
        dur = sec["duration"]
        asset = assets.get(str(sid))
        clip = clips_dir / f"clip_{sid:03d}.mp4"

        if asset and asset["type"] == "video":
            run([
                "ffmpeg", "-y", "-stream_loop", "-1", "-i", asset["path"],
                "-t", f"{dur:.3f}", "-vf", vf_fit, "-an",
                "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
                "-r", str(fps), str(clip),
            ])
        elif asset and asset["type"] == "photo":
            run([
                "ffmpeg", "-y", "-loop", "1", "-i", asset["path"],
                "-t", f"{dur:.3f}", "-vf", vf_fit, "-an",
                "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
                "-r", str(fps), str(clip),
            ])
        else:
            run([
                "ffmpeg", "-y", "-f", "lavfi",
                "-i", f"color=c={bg}:s={w}x{h}:r={fps}",
                "-t", f"{dur:.3f}", "-vf", "format=yuv420p", "-an",
                "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
                str(clip),
            ])
        clip_paths.append(clip)

    # クリップを結合
    list_file = clips_dir / "concat.txt"
    list_file.write_text(
        "\n".join(f"file '{p.resolve()}'" for p in clip_paths), encoding="utf-8"
    )
    visuals = out_dir / "visuals.mp4"
    run([
        "ffmpeg", "-y", "-f", "concat", "-safe", "0",
        "-i", str(list_file), "-c", "copy", str(visuals),
    ])

    # 字幕 SRT を生成
    srt_path = out_dir / "subtitles.srt"
    _write_srt(timeline, srt_path)

    # 音声を乗せて字幕を焼き込み（パスのエスケープ回避のため out_dir を cwd にして相対指定）
    style = _force_style(vcfg["subtitle"])
    video_path = out_dir / "video.mp4"
    run(
        [
            "ffmpeg", "-y",
            "-i", "visuals.mp4",
            "-i", "voice.mp3",
            "-vf", f"subtitles=subtitles.srt:force_style='{style}'",
            "-map", "0:v:0", "-map", "1:a:0",
            "-c:v", "libx264", "-preset", "medium", "-crf", "20",
            "-c:a", "aac", "-b:a", "192k", "-pix_fmt", "yuv420p",
            "-shortest", "video.mp4",
        ],
        cwd=out_dir,
    )
    print(f"  動画: {video_path}  ({timeline['total_duration']:.1f}s)")
    return video_path


def _force_style(s: dict) -> str:
    parts = [
        f"Fontsize={s['font_size']}",
        f"PrimaryColour={s['primary_color']}",
        f"OutlineColour={s['outline_color']}",
        f"BorderStyle=1",
        f"Outline={s['outline']}",
        f"Alignment=2",
        f"MarginV={s['margin_v']}",
    ]
    if s.get("font_name"):
        parts.append(f"FontName={s['font_name']}")
    return ",".join(parts)


def _write_srt(timeline: dict, path: Path) -> None:
    lines: list[str] = []
    idx = 1
    for sec in timeline["sections"]:
        for sub in sec["subtitles"]:
            lines.append(str(idx))
            lines.append(f"{_ts(sub['start'])} --> {_ts(sub['end'])}")
            lines.append(sub["text"])
            lines.append("")
            idx += 1
    path.write_text("\n".join(lines), encoding="utf-8")


def _ts(seconds: float) -> str:
    ms = int(round(seconds * 1000))
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"
