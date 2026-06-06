"""ffmpeg / ffprobe の薄いラッパー。"""
from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path


def ensure_ffmpeg() -> None:
    if shutil.which("ffmpeg") is None or shutil.which("ffprobe") is None:
        raise RuntimeError(
            "ffmpeg / ffprobe が見つかりません。インストールしてください（README参照）。"
        )


def run(args: list[str], cwd: Path | None = None) -> None:
    proc = subprocess.run(args, capture_output=True, text=True, cwd=cwd)
    if proc.returncode != 0:
        raise RuntimeError(
            f"コマンド失敗: {' '.join(args[:3])} ...\n{proc.stderr[-2000:]}"
        )


def probe_duration(path: Path) -> float:
    """メディアの長さ（秒）を返す。"""
    proc = subprocess.run(
        [
            "ffprobe", "-v", "quiet", "-print_format", "json",
            "-show_format", str(path),
        ],
        capture_output=True, text=True,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"ffprobe 失敗: {path}\n{proc.stderr[-1000:]}")
    data = json.loads(proc.stdout)
    return float(data["format"]["duration"])
