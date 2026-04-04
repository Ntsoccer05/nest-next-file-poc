# nest-next-file-poc

ファイルアップロード PoC — **NestJS（BE）+ Next.js（FE）**

悪意のある実行ファイルのブロックと、EXIFメタデータによる作成日時取得を同時に検証するための最小実装です。

---

## 目的

| # | 検証内容 |
|---|---|
| 1 | 悪意のある実行ファイルのブロック（ブロックリスト方式） |
| 2 | ファイル作成日時の取得（EXIF優先 → `lastModified` フォールバック） |

---

## 技術スタック

| レイヤー | 技術 |
|---|---|
| Backend | NestJS（port 3001） |
| Frontend | Next.js 15（port 3000） |
| ファイル検証 | multer（memoryStorage）+ file-type v16（マジックバイト） |
| メタデータ取得 | exiftool-vendored（EXIF/XMP） |

---

## 起動方法

```bash
# バックエンド
cd backend
npm install
npm run start:dev   # http://localhost:3001

# フロントエンド（別ターミナル）
cd frontend
npm install
npm run dev         # http://localhost:3000
```

---

## エンドポイント

### `POST /upload`

| フィールド | 種別 | 必須 | 説明 |
|---|---|---|---|
| `file` | multipart/form-data | ○ | アップロードファイル本体 |
| `lastModified` | Body（文字列） | 任意 | クライアントの `File.lastModified`（Unix ms） |

**成功レスポンス（200）**

```json
{
  "name": "photo.jpg",
  "size": 224896,
  "mimeType": "application/pdf",
  "createdAt": "2025-07-03T20:36:33.000Z",
  "modifiedAt": "2025-07-03T20:37:07.000Z",
  "createdAtSource": "exif",
  "exifCreatedAt": "2025-07-03T20:36:33.000Z",
  "exifModifiedAt": "2025-07-03T20:37:07.000Z",
  "clientLastModified": "2026-03-31T15:57:22.000Z",
  "exifTags": { ... },
  "blocked": false
}
```

**ブロック時（400）**

```json
{ "error": "拡張子 .exe のファイルはアップロードできません" }
```

---

## ブロック対象

### 拡張子

`exe` `dll` `bat` `cmd` `sh` `ps1` `vbs` `jar` `msi` `com` `scr` `pif`

### MIMEタイプ

`application/x-msdownload` `application/x-executable` `application/x-sh` `application/java-archive`

### マジックバイト

file-type で上記 MIME と一致した場合もブロック（拡張子偽装対策）

---

## 作成日時の解決ロジック

```
1. exiftool で EXIF/XMP を読み取る
   優先順位: CreateDate → DateTimeOriginal → TrackCreateDate → MediaCreateDate

2. EXIF がなければ clientLastModified（ブラウザの File.lastModified）を使用

3. どちらもなければ null、createdAtSource = "unknown"
```

### EXIF が取得できる主なファイル形式

| 形式 | EXIF取得 | 備考 |
|---|---|---|
| JPEG / HEIC | ◎ | スマホカメラ写真は特に充実 |
| PDF | ◎ | XMPの CreateDate / ModifyDate |
| MP4 / MOV | ◎ | TrackCreateDate 等 |
| DOCX / XLSX | ○ | core.xml の dcterms:created |
| PNG（スクショ等） | △ | EXIFチャンクなしが多い |
| TXT / CSV / JSON | × | メタデータ構造なし |

---

## ファイル構成

```
.
├── backend/
│   └── src/
│       ├── main.ts
│       ├── app.module.ts
│       └── upload/
│           ├── upload.module.ts
│           ├── upload.controller.ts
│           ├── pipes/
│           │   └── file-safety.pipe.ts      # 3段階ブロック検証
│           └── services/
│               └── file-metadata.service.ts  # EXIF取得 + フォールバック
└── frontend/
    └── src/app/
        ├── layout.tsx
        └── page.tsx                          # アップロードUI + 結果表示
```

---

## 制限事項（PoC のため省略）

- 認証・認可なし
- DB 保存なし
- テストコードなし
- ファイルサイズ上限: 200MB
