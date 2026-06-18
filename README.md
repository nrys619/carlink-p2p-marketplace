# CarLink

個人間中古車売買アプリのMVPです。車検証と写真から出品情報を作り、安全決済・名義変更サポートまでの流れを体験できます。

## Run

```bash
npm install
npm run dev
```

ローカルAPIも使う場合は別ターミナルで起動します。

```bash
npm run api
```

開発版は `http://localhost:5173`、APIは `http://localhost:8787` で動きます。

## Run As A Real Local Web App

PCをサーバーにしてスマホ実機から使う場合:

```bash
npm run serve
```

PCのIPアドレスを確認します。

```bash
ipconfig getifaddr en0
```

スマホで以下を開きます。

```text
http://<PCのIPアドレス>:8787/
```

例:

```text
http://192.168.1.23:8787/
```

このモードでは、出品・チャット・お気に入り・取引状態が `server-data/state.json` に保存されます。同じWi-Fi内の別端末から開いても同じデータを見られます。

## Production Build

```bash
npm run build
npm run preview
```

リリース前の品質チェックは以下でまとめて実行できます。

```bash
npm run check
```

## Deploy

API保存、ログイン、OCR連携まで同じURLで動かすなら、まずは Render / Railway / Fly.io などのNodeサーバー対応ホスティングがおすすめです。静的表示だけならVercelまたはNetlifyにもデプロイできます。

- Build command: `npm run build`
- Render build command: `npm ci --include=dev && npm run check`
- Start command: `node server/index.mjs`
- Health check: `/api/health`
- Docker: `Dockerfile`
- Render blueprint: `render.yaml`
- Railway config: `railway.json`
- Static output directory: `dist`
- SPA routing: `vercel.json` / `netlify.toml`で設定済み
- Pre-release check: `npm run check`

本番環境変数:

```text
NODE_ENV=production
PORT=8787
CORS_ORIGIN=https://公開ドメイン
OPENAI_API_KEY=sk-...
OPENAI_VISION_MODEL=gpt-4.1-mini
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_PHONE=
```

## App Install

PWA対応済みです。スマホのブラウザで公開URLを開き、ホーム画面に追加するとアプリのように起動できます。

## Current MVP Scope

- 車両検索、価格上限フィルター
- 64メーカー、1000車種以上の車種カタログ検索
- 車検証OCR風の自動入力
- 写真アップロードとプレビュー
- AI装備候補の選択
- 価格提案と価格プリセット
- 掲載処理とローカル保存
- チャット送信とローカル保存
- 安全決済・名義変更ステータス表示
- PWA manifest、service worker、ホーム画面追加対応

## Production Integrations Needed

- 本人確認: eKYCサービス
- 決済/エスクロー: 決済代行または資金移動業者との連携
- 車検証: OCR API、電子車検証API
- 画像保存: Supabase Storage、Firebase Storage、S3など
- DB/Auth: Supabase、Firebase、または独自API
- 名義変更: 行政書士・陸送会社とのオペレーション連携

## Backend Notes

- DB draft: `supabase/schema.sql`
- Release checklist: `docs/release-checklist.md`
- Backend roadmap: `docs/backend-roadmap.md`
- Environment template: `.env.example`
