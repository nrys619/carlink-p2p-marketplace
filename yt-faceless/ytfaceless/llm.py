"""Anthropic クライアントのラッパー。台本・メタデータの JSON 生成に使う。"""
from __future__ import annotations

import json
import re
from typing import Any

import anthropic


class LLM:
    def __init__(self, api_key: str, model: str = "claude-opus-4-8", effort: str = "high") -> None:
        self.client = anthropic.Anthropic(api_key=api_key)
        self.model = model
        self.effort = effort

    def complete_json(self, system: str, user: str, max_tokens: int = 16000) -> dict[str, Any]:
        """JSON を返すプロンプトを投げ、辞書としてパースして返す。

        adaptive thinking を使い、サンプリングパラメータは渡さない（Opus 4.8 仕様）。
        """
        resp = self.client.messages.create(
            model=self.model,
            max_tokens=max_tokens,
            thinking={"type": "adaptive"},
            output_config={"effort": self.effort},
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        text = "".join(b.text for b in resp.content if b.type == "text")
        return _parse_json(text)


def _parse_json(text: str) -> dict[str, Any]:
    """LLM 出力から JSON を頑健に取り出す。"""
    text = text.strip()
    # ```json ... ``` のコードフェンスを除去
    fence = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL)
    if fence:
        text = fence.group(1).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # 最初の { から最後の } までを抜き出して再挑戦
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        return json.loads(text[start : end + 1])
    raise ValueError("LLM 出力から JSON を解析できませんでした:\n" + text[:500])
