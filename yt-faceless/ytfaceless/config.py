"""設定と環境変数のロード。"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import yaml
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
PROMPTS_DIR = ROOT / "prompts"

# config.yaml が無くてもこの既定値で動く
DEFAULTS: dict[str, Any] = {
    "llm": {"model": "claude-opus-4-8", "effort": "high"},
    "script": {"target_minutes": 6, "language": "ja"},
    "tts": {
        "voice_id": "21m00Tcm4TlvDq8ikWAM",
        "model_id": "eleven_multilingual_v2",
        "stability": 0.5,
        "similarity_boost": 0.75,
    },
    "video": {
        "width": 1920,
        "height": 1080,
        "fps": 30,
        "background_color": "#0f1115",
        "subtitle": {
            "font_size": 54,
            "primary_color": "&H00FFFFFF",
            "outline_color": "&H00000000",
            "outline": 3,
            "margin_v": 90,
        },
    },
    "assets": {"per_section": 1, "prefer": "video"},
}


def _deep_merge(base: dict, override: dict) -> dict:
    out = dict(base)
    for k, v in override.items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _deep_merge(out[k], v)
        else:
            out[k] = v
    return out


class Config:
    def __init__(self) -> None:
        load_dotenv(ROOT / ".env")
        load_dotenv()  # カレントの .env もフォールバックで読む

        cfg_path = ROOT / "config.yaml"
        data = DEFAULTS
        if cfg_path.exists():
            with open(cfg_path, encoding="utf-8") as f:
                user_cfg = yaml.safe_load(f) or {}
            data = _deep_merge(DEFAULTS, user_cfg)
        self.data = data

    # --- セクション別アクセサ ---
    @property
    def llm(self) -> dict:
        return self.data["llm"]

    @property
    def script(self) -> dict:
        return self.data["script"]

    @property
    def tts(self) -> dict:
        return self.data["tts"]

    @property
    def video(self) -> dict:
        return self.data["video"]

    @property
    def assets(self) -> dict:
        return self.data["assets"]

    # --- 環境変数 ---
    @property
    def anthropic_key(self) -> str | None:
        return os.getenv("ANTHROPIC_API_KEY")

    @property
    def elevenlabs_key(self) -> str | None:
        return os.getenv("ELEVENLABS_API_KEY")

    @property
    def pexels_key(self) -> str | None:
        return os.getenv("PEXELS_API_KEY")

    @property
    def youtube_client_secret(self) -> str:
        return os.getenv("YOUTUBE_CLIENT_SECRET", "client_secret.json")

    @property
    def youtube_token_file(self) -> str:
        return os.getenv("YOUTUBE_TOKEN_FILE", "token.json")

    def load_prompt(self, name: str) -> str:
        return (PROMPTS_DIR / name).read_text(encoding="utf-8")
