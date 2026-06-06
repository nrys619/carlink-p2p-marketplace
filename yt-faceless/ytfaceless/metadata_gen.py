"""ステージ5: メタデータ生成（タイトル/説明/タグ/チャプター）。"""
from __future__ import annotations

import json
from pathlib import Path

from .config import Config
from .llm import LLM


def generate_metadata(cfg: Config, out_dir: Path) -> dict:
    if not cfg.anthropic_key:
        raise RuntimeError("ANTHROPIC_API_KEY が未設定です（.env を確認）")

    script = json.loads((out_dir / "script.json").read_text(encoding="utf-8"))
    timeline = json.loads((out_dir / "timeline.json").read_text(encoding="utf-8"))

    # セクションの開始秒をモデルに渡す（チャプター算出用）
    sec_summary = []
    for sec in timeline["sections"]:
        first = next((s["text"] for s in sec["subtitles"]), "")
        sec_summary.append({
            "id": sec["id"],
            "label": sec["label"],
            "start": _mmss(sec["start"]),
            "hint": first,
        })

    llm = LLM(cfg.anthropic_key, cfg.llm["model"], cfg.llm["effort"])
    system = cfg.load_prompt("metadata_system_ja.txt")
    user = (
        "台本(JSON):\n"
        + json.dumps(script, ensure_ascii=False)
        + "\n\nセクションの開始時刻:\n"
        + json.dumps(sec_summary, ensure_ascii=False)
        + f"\n\n総再生時間: {_mmss(timeline['total_duration'])}\n"
        "スキーマ通りのメタデータJSONを作ってください。"
    )

    meta = llm.complete_json(system, user)
    (out_dir / "metadata.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    _write_readable(meta, out_dir)
    print(f"  メタデータ: タイトル候補 {len(meta.get('titles', []))}件 / タグ {len(meta.get('tags', []))}件")
    return meta


def _write_readable(meta: dict, out_dir: Path) -> None:
    out = []
    out.append("=== タイトル候補 ===")
    for i, t in enumerate(meta.get("titles", []), 1):
        out.append(f"{i}. {t}")
    out.append("\n=== 説明文 ===")
    out.append(meta.get("description", ""))
    chapters = meta.get("chapters", [])
    if chapters:
        out.append("\n=== チャプター（説明欄に貼る）===")
        for c in chapters:
            out.append(f"{c.get('time','0:00')} {c.get('label','')}")
    out.append("\n=== タグ ===")
    out.append(", ".join(meta.get("tags", [])))
    (out_dir / "metadata.txt").write_text("\n".join(out), encoding="utf-8")


def _mmss(seconds: float) -> str:
    total = int(round(seconds))
    m, s = divmod(total, 60)
    return f"{m}:{s:02d}"
