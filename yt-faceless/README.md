# yt-faceless 🎬

顔出しなし・AI自動化の YouTube 動画パイプライン（日本語向け）。

トピックを1つ渡すと、**台本生成 → 音声合成 → 素材取得 → 動画組み立て → メタデータ生成 → YouTube投稿** までを一気通貫で実行します。

```
トピック
  └─ 1. 台本生成        … Claude API (claude-opus-4-8)
  └─ 2. 音声合成 (TTS)  … ElevenLabs
  └─ 3. 素材取得        … Pexels (動画/画像)
  └─ 4. 動画組み立て    … FFmpeg（音声 + 映像 + 字幕焼き込み）
  └─ 5. メタデータ生成  … Claude API（タイトル/説明/タグ/チャプター）
  └─ 6. YouTube投稿     … YouTube Data API v3（任意）
```

> ⚠️ **正直な前提**
> - これは「半自動」の制作ツールです。コマンド一発で**下書き動画＋メタデータ**まで作れますが、最終チェックは人が入れることを強く推奨します。
> - YouTube は2025年以降、**大量生産の低品質な完全自動コンテンツ**を収益化対象外にする方針を強めています。量産より「1本の質」を上げる使い方を推奨します。
> - 収益は保証されません。ツールはあくまで制作の効率化です。

---

## 必要なもの

| 用途 | 必須 | 入手先 |
|---|---|---|
| 台本・メタデータ生成 | ✅ | `ANTHROPIC_API_KEY`（[console.anthropic.com](https://console.anthropic.com)） |
| 音声合成 | ✅ | `ELEVENLABS_API_KEY`（[elevenlabs.io](https://elevenlabs.io)） |
| 映像素材 | 任意 | `PEXELS_API_KEY`（無料・[pexels.com/api](https://www.pexels.com/api/)）。無ければ単色背景にフォールバック |
| 動画組み立て | ✅ | `ffmpeg`（システムにインストール） |
| YouTube投稿 | 任意 | Google Cloud の OAuth クライアント（`client_secret.json`） |

### ffmpeg のインストール
```bash
# macOS
brew install ffmpeg
# Ubuntu/Debian
sudo apt-get install -y ffmpeg
# Windows
winget install Gyan.FFmpeg
```

---

## セットアップ

```bash
cd yt-faceless
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env        # キーを記入
cp config.example.yaml config.yaml   # 必要なら設定を編集
```

`.env` を編集してキーを入れてください。

---

## 使い方

### 1. まずは動画を1本作る（投稿はしない）
```bash
python pipeline.py --topic "新NISAでやってはいけない3つの失敗" --niche "金融・資産運用"
```
`output/<日時_スラグ>/` に以下が生成されます：
- `script.json` … 台本（セクション分割・字幕・Bロール指示つき）
- `voice.mp3` … ナレーション音声
- `video.mp4` … 完成動画（字幕焼き込み済み）
- `metadata.json` / `metadata.txt` … タイトル候補・説明文・タグ・チャプター

### 2. 台本だけ確認したいとき
```bash
python pipeline.py --topic "..." --only script
```

### 3. 既存の出力から続きだけ実行
```bash
python pipeline.py --resume output/20260606_xxxx --from assemble
```

### 4. 確認後に YouTube へ投稿
```bash
python pipeline.py --resume output/20260606_xxxx --from upload --privacy private
```
> 初回は `client_secret.json` を使ったブラウザ認証が走り、`token.json` が保存されます。
> `--privacy` は `private`（既定）/ `unlisted` / `public`。**まずは private で確認してから公開**してください。

---

## ステージ

`--from` / `--only` で指定できるステージ名：

`script` → `tts` → `assets` → `assemble` → `metadata` → `upload`

`upload` 以外はキーが揃っていれば全自動で流れます。`upload` は明示的に指定したときだけ実行されます（事故防止）。

---

## ディレクトリ構成

```
yt-faceless/
├── pipeline.py          # CLI オーケストレーター
├── ytfaceless/
│   ├── config.py        # 設定/環境変数のロード
│   ├── llm.py           # Anthropic クライアント
│   ├── script_gen.py    # ステージ1: 台本
│   ├── tts.py           # ステージ2: 音声 (ElevenLabs)
│   ├── assets.py        # ステージ3: 素材 (Pexels)
│   ├── assemble.py      # ステージ4: 動画 (FFmpeg)
│   ├── metadata_gen.py  # ステージ5: メタデータ
│   └── upload.py        # ステージ6: YouTube 投稿
├── prompts/             # 編集可能なプロンプト
├── requirements.txt
├── .env.example
└── config.example.yaml
```

プロンプトは `prompts/` のテキストを書き換えるだけでチューニングできます。
