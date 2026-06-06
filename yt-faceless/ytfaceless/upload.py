"""ステージ6: YouTube への投稿（YouTube Data API v3）。

初回は client_secret.json を使ったブラウザ認証が走り、token.json を保存する。
事故防止のため、このステージは pipeline.py から明示指定したときだけ実行される。
"""
from __future__ import annotations

import json
from pathlib import Path

from .config import Config

SCOPES = ["https://www.googleapis.com/auth/youtube.upload"]


def upload_video(cfg: Config, out_dir: Path, privacy: str = "private", title: str | None = None) -> str:
    try:
        from google.auth.transport.requests import Request
        from google.oauth2.credentials import Credentials
        from google_auth_oauthlib.flow import InstalledAppFlow
        from googleapiclient.discovery import build
        from googleapiclient.http import MediaFileUpload
    except ImportError as e:  # noqa: BLE001
        raise RuntimeError(
            "Google ライブラリが未インストールです: pip install -r requirements.txt"
        ) from e

    video_path = out_dir / "video.mp4"
    if not video_path.exists():
        raise RuntimeError("video.mp4 がありません。先に assemble ステージを実行してください。")

    meta = json.loads((out_dir / "metadata.json").read_text(encoding="utf-8"))
    titles = meta.get("titles", [])
    final_title = title or (titles[0] if titles else "無題")
    description = _build_description(meta)
    tags = meta.get("tags", [])

    creds = _get_credentials(cfg, Credentials, Request, InstalledAppFlow)
    youtube = build("youtube", "v3", credentials=creds)

    body = {
        "snippet": {
            "title": final_title[:100],
            "description": description[:5000],
            "tags": tags[:30],
            "categoryId": "27",  # Education
        },
        "status": {
            "privacyStatus": privacy,
            "selfDeclaredMadeForKids": False,
        },
    }

    media = MediaFileUpload(str(video_path), chunksize=-1, resumable=True, mimetype="video/mp4")
    request = youtube.videos().insert(part="snippet,status", body=body, media_body=media)

    print(f"  アップロード中... (privacy={privacy})")
    response = None
    while response is None:
        status, response = request.next_chunk()
        if status:
            print(f"    {int(status.progress() * 100)}%")

    video_id = response["id"]
    url = f"https://youtu.be/{video_id}"
    (out_dir / "youtube.json").write_text(
        json.dumps({"id": video_id, "url": url, "privacy": privacy}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"  投稿完了: {url}")
    return url


def _build_description(meta: dict) -> str:
    parts = [meta.get("description", "")]
    chapters = meta.get("chapters", [])
    if chapters:
        parts.append("")
        for c in chapters:
            parts.append(f"{c.get('time', '0:00')} {c.get('label', '')}")
    return "\n".join(parts)


def _get_credentials(cfg: Config, Credentials, Request, InstalledAppFlow):
    token_path = Path(cfg.youtube_token_file)
    creds = None
    if token_path.exists():
        creds = Credentials.from_authorized_user_file(str(token_path), SCOPES)
    if creds and creds.valid:
        return creds
    if creds and creds.expired and creds.refresh_token:
        creds.refresh(Request())
        token_path.write_text(creds.to_json(), encoding="utf-8")
        return creds

    secret_path = Path(cfg.youtube_client_secret)
    if not secret_path.exists():
        raise RuntimeError(
            f"OAuth クライアント JSON が見つかりません: {secret_path}\n"
            "Google Cloud Console で OAuth クライアント(デスクトップアプリ)を作り、"
            "ダウンロードした JSON を配置して .env の YOUTUBE_CLIENT_SECRET に指定してください。"
        )
    flow = InstalledAppFlow.from_client_secrets_file(str(secret_path), SCOPES)
    creds = flow.run_local_server(port=0)
    token_path.write_text(creds.to_json(), encoding="utf-8")
    return creds
