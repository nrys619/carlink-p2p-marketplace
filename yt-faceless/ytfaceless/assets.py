"""ステージ3: 映像素材の取得（Pexels）。

PEXELS_API_KEY が無い、または検索ヒットが無いセクションは
None を返し、組み立て時に単色背景へフォールバックする。
"""
from __future__ import annotations

import json
from pathlib import Path

import requests

VIDEO_SEARCH = "https://api.pexels.com/videos/search"
PHOTO_SEARCH = "https://api.pexels.com/v1/search"


def fetch_assets(cfg, out_dir: Path) -> dict:
    timeline = json.loads((out_dir / "timeline.json").read_text(encoding="utf-8"))
    assets_dir = out_dir / "assets"
    assets_dir.mkdir(exist_ok=True)

    result: dict[str, dict | None] = {}
    if not cfg.pexels_key:
        print("  PEXELS_API_KEY なし → 全セクション単色背景にフォールバック")
        for sec in timeline["sections"]:
            result[str(sec["id"])] = None
        _save(result, out_dir)
        return result

    prefer = cfg.assets.get("prefer", "video")
    for sec in timeline["sections"]:
        query = (sec.get("broll_query") or "").strip()
        sid = sec["id"]
        asset = None
        if query:
            try:
                if prefer == "video":
                    asset = _fetch_video(cfg.pexels_key, query, assets_dir, sid)
                if asset is None:
                    asset = _fetch_photo(cfg.pexels_key, query, assets_dir, sid)
            except Exception as e:  # noqa: BLE001 - 1セクションの失敗で全体を止めない
                print(f"  section {sid}: 素材取得失敗 ({e}) → 背景色")
        if asset:
            print(f"  section {sid}: {asset['type']}  '{query}'")
        else:
            print(f"  section {sid}: 素材なし → 背景色")
        result[str(sid)] = asset

    _save(result, out_dir)
    return result


def _fetch_video(key: str, query: str, assets_dir: Path, sid: int) -> dict | None:
    r = requests.get(
        VIDEO_SEARCH,
        headers={"Authorization": key},
        params={"query": query, "per_page": 1, "orientation": "landscape"},
        timeout=60,
    )
    r.raise_for_status()
    videos = r.json().get("videos", [])
    if not videos:
        return None
    files = videos[0].get("video_files", [])
    # 横向きで 1080p 前後を優先、無ければ最大解像度
    landscape = [f for f in files if (f.get("width") or 0) >= (f.get("height") or 0)]
    pool = landscape or files
    pool.sort(key=lambda f: abs((f.get("height") or 0) - 1080))
    chosen = pool[0]
    path = assets_dir / f"section_{sid:03d}.mp4"
    _download(chosen["link"], path)
    return {"type": "video", "path": str(path)}


def _fetch_photo(key: str, query: str, assets_dir: Path, sid: int) -> dict | None:
    r = requests.get(
        PHOTO_SEARCH,
        headers={"Authorization": key},
        params={"query": query, "per_page": 1, "orientation": "landscape"},
        timeout=60,
    )
    r.raise_for_status()
    photos = r.json().get("photos", [])
    if not photos:
        return None
    src = photos[0]["src"]
    url = src.get("large2x") or src.get("original") or src.get("large")
    path = assets_dir / f"section_{sid:03d}.jpg"
    _download(url, path)
    return {"type": "photo", "path": str(path)}


def _download(url: str, path: Path) -> None:
    with requests.get(url, stream=True, timeout=120) as r:
        r.raise_for_status()
        with open(path, "wb") as f:
            for chunk in r.iter_content(chunk_size=1 << 16):
                f.write(chunk)


def _save(result: dict, out_dir: Path) -> None:
    (out_dir / "assets.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8"
    )
