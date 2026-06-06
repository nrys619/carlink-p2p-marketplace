"""ステージ1: 台本生成。"""
from __future__ import annotations

import json
from pathlib import Path

from .config import Config
from .llm import LLM


def generate_script(cfg: Config, topic: str, niche: str, out_dir: Path) -> dict:
    if not cfg.anthropic_key:
        raise RuntimeError("ANTHROPIC_API_KEY が未設定です（.env を確認）")

    llm = LLM(cfg.anthropic_key, cfg.llm["model"], cfg.llm["effort"])
    system = cfg.load_prompt("script_system_ja.txt")

    target_min = cfg.script["target_minutes"]
    user = (
        f"ニッチ: {niche or '指定なし'}\n"
        f"動画のテーマ/タイトル: {topic}\n"
        f"目標の動画尺: 約{target_min}分\n\n"
        "上記でスキーマ通りのJSON台本を作ってください。"
    )

    script = llm.complete_json(system, user)
    _validate(script)

    path = out_dir / "script.json"
    path.write_text(json.dumps(script, ensure_ascii=False, indent=2), encoding="utf-8")
    _print_summary(script)
    return script


def _validate(script: dict) -> None:
    if "sections" not in script or not isinstance(script["sections"], list) or not script["sections"]:
        raise ValueError("台本に sections がありません")
    for i, sec in enumerate(script["sections"]):
        sec.setdefault("id", i + 1)
        sec.setdefault("label", "body")
        sec.setdefault("broll_query", "")
        lines = sec.get("lines")
        if not isinstance(lines, list) or not lines:
            raise ValueError(f"section {sec.get('id')} に lines がありません")
        # 念のため空行を除去
        sec["lines"] = [str(x).strip() for x in lines if str(x).strip()]


def _print_summary(script: dict) -> None:
    total_chars = sum(len("".join(s["lines"])) for s in script["sections"])
    print(f"  台本: {len(script['sections'])} セクション / 約 {total_chars} 文字")
    print(f"  作業用タイトル: {script.get('title_working', '(なし)')}")
