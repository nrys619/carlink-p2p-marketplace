# Production Architecture

CarLink を実サービスとして公開する場合の構成案です。

## Frontend

- React/Vite PWA
- 写真アップロード、車検証読み取り、出品作成、検索、チャット、取引ステータス
- Service Worker は静的アセットのキャッシュのみ。個人情報や車検証画像はブラウザキャッシュに載せない設計にする

## Backend

- API Gateway / App Server
- Auth: 電話番号認証 + eKYC
- DB: PostgreSQL
- Storage: S3互換ストレージ
- Queue: 画像解析、OCR、通知、名義変更タスク
- Audit Log: 本人確認、決済、名義変更、公開/非公開操作を追跡

## External Services

- eKYC: 犯収法対応の本人確認
- Payment/Escrow: 資金移動業者または収納代行スキーム
- OCR: `OPENAI_API_KEY` がある場合は OpenAI Responses API の画像入力で車検証/車両写真を解析。未設定時はローカル推定へフォールバック
- 電子車検証IC読み取り: Web NFC は Android Chrome + HTTPS 前提。iOSや未対応端末では写真OCRへフォールバック
- Image AI: 車両写真から装備候補、外装状態、メーター値候補を抽出
- Admin: 出品審査、通報対応、返金/キャンセル対応

## Release Gates

- `npm run check` が通る
- `NODE_ENV=production` で `/api/readiness` の HTTPS / OCR / PWA チェックが通る
- プライバシーポリシー、利用規約、特商法/古物商表示が確定
- 決済フローの法務確認が完了
- 車検証・本人確認画像の保存場所、保存期間、削除導線が確定
- 通報、出品停止、アカウント停止、証跡ダウンロードが管理画面で可能

## First Paid Beta Scope

- 同一都道府県または同一運輸支局管轄に限定
- 出品者/購入者の本人確認必須
- 決済は提携決済事業者の画面に遷移
- 名義変更は提携行政書士の手動オペレーション
- AI読み取りは補助。公開前のユーザー確認を必須
