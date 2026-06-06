#!/usr/bin/env python3
"""yt-faceless パイプライン・オーケストレーター。

使い方の例:
  python pipeline.py --topic "新NISAでやってはいけない3つの失敗" --niche "金融・資産運用"
  python pipeline.py --topic "..." --only script
  python pipeline.py --resume output/20260606_xxxx --from assemble
  python pipeline.py --resume output/20260606_xxxx --from upload --privacy private
"""
from __future__ import annotations

import argparse
import re
import sys
from datetime import datetime
from pathlib import Path

from ytfaceless.config import Config

STAGES = ["script", "tts", "assets", "assemble", "metadata", "upload"]
ROOT = Path(__file__).resolve().parent


def slugify(text: str) -> str:
    s = re.sub(r'[\\/:*?"<>|\s]+', "_", text).strip("_")
    return s[:30] or "video"


def resolve_stages(args) -> list[str]:
    if args.only:
        return [args.only]
    if args.from_stage:
        i = STAGES.index(args.from_stage)
        stages = STAGES[i:]
        if args.from_stage != "upload":
            stages = [s for s in stages if s != "upload"]
        return stages
    # 既定: upload 以外を全部
    return [s for s in STAGES if s != "upload"]


def main() -> int:
    p = argparse.ArgumentParser(description="顔出しなし AI YouTube パイプライン")
    p.add_argument("--topic", help="動画のテーマ/タイトル")
    p.add_argument("--niche", default="", help="ニッチ（任意）")
    p.add_argument("--only", choices=STAGES, help="このステージだけ実行")
    p.add_argument("--from", dest="from_stage", choices=STAGES, help="このステージから最後まで実行")
    p.add_argument("--resume", help="既存の output ディレクトリを使う")
    p.add_argument("--privacy", default="private", choices=["private", "unlisted", "public"],
                   help="投稿時の公開設定（既定: private）")
    p.add_argument("--title", help="投稿時に使うタイトル（省略時は候補の1番目）")
    args = p.parse_args()

    cfg = Config()
    stages = resolve_stages(args)

    # 出力ディレクトリの決定
    if args.resume:
        out_dir = Path(args.resume)
        if not out_dir.exists():
            print(f"エラー: 指定の resume ディレクトリがありません: {out_dir}", file=sys.stderr)
            return 1
    else:
        if "script" not in stages:
            print("エラー: --resume なしで script 以外から始めることはできません", file=sys.stderr)
            return 1
        if not args.topic:
            print("エラー: --topic が必要です", file=sys.stderr)
            return 1
        out_dir = ROOT / "output" / f"{datetime.now():%Y%m%d_%H%M%S}_{slugify(args.topic)}"
        out_dir.mkdir(parents=True, exist_ok=True)

    if "script" in stages and not args.topic:
        print("エラー: script ステージには --topic が必要です", file=sys.stderr)
        return 1

    print(f"出力先: {out_dir}")
    print(f"実行ステージ: {' → '.join(stages)}\n")

    try:
        _run(cfg, stages, args, out_dir)
    except Exception as e:  # noqa: BLE001
        print(f"\n✗ 失敗: {e}", file=sys.stderr)
        return 1

    _final_notes(stages, out_dir)
    return 0


def _run(cfg: Config, stages: list[str], args, out_dir: Path) -> None:
    if "script" in stages:
        print("▶ [1/6] 台本生成")
        from ytfaceless.script_gen import generate_script
        generate_script(cfg, args.topic, args.niche, out_dir)

    if "tts" in stages:
        print("▶ [2/6] 音声合成")
        from ytfaceless.tts import synthesize
        synthesize(cfg, out_dir)

    if "assets" in stages:
        print("▶ [3/6] 素材取得")
        from ytfaceless.assets import fetch_assets
        fetch_assets(cfg, out_dir)

    if "assemble" in stages:
        print("▶ [4/6] 動画組み立て")
        from ytfaceless.assemble import assemble
        assemble(cfg, out_dir)

    if "metadata" in stages:
        print("▶ [5/6] メタデータ生成")
        from ytfaceless.metadata_gen import generate_metadata
        generate_metadata(cfg, out_dir)

    if "upload" in stages:
        print("▶ [6/6] YouTube 投稿")
        from ytfaceless.upload import upload_video
        upload_video(cfg, out_dir, privacy=args.privacy, title=args.title)


def _final_notes(stages: list[str], out_dir: Path) -> None:
    print("\n✓ 完了")
    if "upload" not in stages:
        print(f"\n次のステップ:")
        if (out_dir / "video.mp4").exists():
            print(f"  - 動画を確認: {out_dir / 'video.mp4'}")
        if (out_dir / "metadata.txt").exists():
            print(f"  - メタデータ: {out_dir / 'metadata.txt'}")
        print(f"  - 問題なければ投稿: python pipeline.py --resume {out_dir} --from upload --privacy private")


if __name__ == "__main__":
    raise SystemExit(main())
