# CLAUDE.md - Project Guidelines for Claude

## Code Review Prompt

このプロジェクトのベストプラクティスに基づいてコードレビューを実施してください。

### プロジェクト概要

- **Backend**: NestJS（port 3001）
- **Frontend**: Next.js v15（port 3000）
- **ファイル検証**: multer + file-type + exiftool-vendored
- **目的**: EXIFメタデータ取得と悪意ファイルのブロック

### Backend（NestJS）レビュー観点

- exiftool-vendored の生存期間管理（`onModuleDestroy` で必ず `end()`）
- 一時ファイルの cleanup（`finally` で必ず削除）
- 複数段階のセキュリティチェック（拡張子 → MIME → マジックバイト）
- エラーメッセージは日本語
- Pipe・Service の責任分離が明確か
- FileMetadataService で EXIF の優先順位が正確か（CreateDate → DateTimeOriginal → TrackCreateDate → MediaCreateDate）

### Frontend（Next.js）レビュー観点

- SSR/CSR hydration mismatch の回避（`useIsClient` フック使用等）
- 日本語UI（JST/UTC 両方表示）
- エラー時の適切なユーザーフィードバック
- ファイルサイズ表示の Locale 対応（`toLocaleString()`）
- `exifTags` が undefined 時の null safety（`?? {}`）

### 共通チェック項目

- EXIF メタデータの正確な取得ロジック
- メモリリーク防止（tempFile 削除、ExifTool 終了）
- null safety（`createdAt`/`modifiedAt` が null の場合の扱い）
- JSON シリアライズ可能性（Buffer 除外、日時は ISO 文字列化）
- CORS 設定（フロントエンド `http://localhost:3000` に限定）

### Commit・PR 品質

- commit message が明確か（何をした・なぜか）
- breaking change の有無を確認
- 不要な依存追加・アップデートがないか
- PoC品質の制限（テストなし等）は許容

---

## Development Preferences

- **Error Messages**: 日本語
- **Date Format**: ISO 8601（UTC）を基本、UI 表示時は JST に変換
- **PoC Scope**: テストコード・Swagger・Docker は不要
- **Security**: 実行ファイルの3段階チェック必須
- **File Size Limit**: 200MB
