# AGENTS.md

このファイルはAIエージェント（Claude Code等）がこのプロジェクトで作業する際のガイドです。

## プロジェクト概要

デジタルハリウッド大学大学院「テクノロジー特論D（人工現実）」の授業運営支援プロジェクト。Google Apps Script（GAS）とスプレッドシートを連携。

## リンク

- **スプレッドシート**: https://docs.google.com/spreadsheets/d/1WPJYZ9CZ2gm5HUToDGTwTs0jbuTCln6Qs924L6iMnDA/edit
- **GASスクリプトエディタ**: https://script.google.com/home/projects/1HvfDdtHGDAhhQceaODn-DRuU7hhtgMCuE7Fj7fP6Vo2FG7E4ypqWYn03/edit

## 重要: コード管理

**GASスクリプトエディタで直接コードを編集しないこと。**

このプロジェクトは `clasp` を使用してこのGitリポジトリから管理している。

```bash
# コード変更後のデプロイ
clasp push -f

# GAS側の変更を取得（通常は不要）
clasp pull
```

## セキュリティ要件

### 絶対に守るべきルール

1. **個人情報にアクセスしない**
   - 学生の氏名、学籍番号、メールアドレス
   - 成績、出席情報
   - 受講者名簿

2. **機密情報をコミットしない**
   - `.clasp.json`（スクリプトID）→ `.gitignore`で除外済み
   - APIキー → ScriptPropertiesに保存、コードに書かない
   - スプレッドシートID → 公開情報だが、他の機密情報と組み合わせない

3. **APIアクセス制御を維持**
   - `isSheetAllowed()` 関数の許可パターンを安易に拡大しない
   - 個人情報を含むシートへのアクセスを追加しない

### APIは読み取り専用

現在のAPIは読み取りのみ。書き込み機能を追加する場合は、より厳格な認証とバリデーションが必要。

## API使用方法

### 認証情報

```bash
BASE_URL="https://script.google.com/macros/s/AKfycbwu4-Wrh_qhtx9LumtcPXEIEWJuQ3hzBtgN3uatcq2leXUtE2qMziKW61wqnkPMYCNpLA/exec"
API_KEY="387dce93-d339-463a-9dcb-8b88da377fe6"
```

### リクエスト例

```bash
# 全シートメタデータ取得
curl -sL "$BASE_URL?key=$API_KEY&action=all"

# シラバス内容取得（通常形式）
curl -sL --get "$BASE_URL" \
  --data-urlencode "key=$API_KEY" \
  --data-urlencode "action=read" \
  --data-urlencode "sheet=シラバス23"

# シラバス24/25/26形式専用（構造化JSON）
curl -sL --get "$BASE_URL" \
  --data-urlencode "key=$API_KEY" \
  --data-urlencode "action=readSyllabus" \
  --data-urlencode "sheet=シラバス25"

# リンクされたフォーム一覧
curl -sL "$BASE_URL?key=$API_KEY&action=forms"

# フォーム構造取得
curl -sL --get "$BASE_URL" \
  --data-urlencode "key=$API_KEY" \
  --data-urlencode "action=formStructure" \
  --data-urlencode "formId=FORM_ID"

# スライド内容取得（許可されたスライドのみ）
curl -sL --get "$BASE_URL" \
  --data-urlencode "key=$API_KEY" \
  --data-urlencode "action=slides" \
  --data-urlencode "slideId=115gBQJ9xHQ0_TPVZEtjtfhhVxCbP528rVOpTl-WddC0"
```

### 利用可能なシート（ホワイトリスト）

- シラバス21, シラバス22, シラバス23, シラバス24, シラバス25, シラバス26

### 許可されたスライドID

- `115gBQJ9xHQ0_TPVZEtjtfhhVxCbP528rVOpTl-WddC0` (DHGSVR25-講義準備)

## シラバス作成ガイドライン

シラバスを編集する際は、以下のルールを厳守すること：

1. **日本語で記載**
2. **「である体」で記述**
3. **文章は主節と従節を省略せず、体言止めを使わない**
4. **英数字は半角**
5. **インデントや飾り文字を使わない**
6. **「・」（なかぐろ）や機種依存文字を使わない**
7. **箇条書きは（1）（2）（3）を先頭につける**

### 各項目の要件

| 項目 | 要件 |
|------|------|
| タイトル | 20文字以内、毎回異なる、句読点・記号不可 |
| 内容 | 150文字以内、毎回異なる |
| キーワード | 3〜5個、各10文字以内（最大20文字）、日本語 |
| 到達目標 | 2〜4個、学生が主語、客観的に評価可能 |
| 成績評価 | 2要素以上、各要素の割合を%で明記、合計100% |

## 講義構成（8回）

| Part | 回 | テーマ |
|------|---|--------|
| 導入 | 1 | 人工現実概論 |
| Part 1 | 2 | ジェネレーティブAI |
| Part 2 | 3-5 | メタバース（WebXR, Hubs/DOOR） |
| Part 3 | 6-7 | VTuber（設計・発信） |
| まとめ | 8 | 人工現実の未来開発 |

## 主要キーワード

- VR / 人工現実 / メタバース
- VTuber / アバター
- WebXR / Mozilla Hubs / DOOR
- Generative AI / 画像生成AI
- エンゲージメント設計
- ソーシャルVR

## 開発フロー

```bash
# 1. コード編集（このリポジトリ内で）
vim Code.js

# 2. GASにプッシュ
clasp push -f

# 3. テスト（APIリクエスト）
curl -sL "$BASE_URL?key=$API_KEY&action=all"
```

## タスク例

### シラバス26の作成

1. シラバス25の内容をAPIで取得
2. 2026年度向けに更新（新技術トレンド反映）
3. ガイドラインに準拠しているか検証
4. スプレッドシートに反映（手動またはGAS経由）

### 新機能追加時の注意

- `isSheetAllowed()` で許可パターンを確認
- 個人情報を含むシートへのアクセスを追加しない
- 書き込み機能を追加する場合は認証を強化
- コードはこのリポジトリで管理、GASエディタで直接編集しない

## フォーム送信時の自動処理

フォーム送信時に `onFormSubmit()` がトリガーされ、以下を実行する：

1. **Slack通知**: 課題提出情報を指定チャンネルに投稿
2. **成績登録**: 管理シート（25課題）に提出日時を記録

### 設定方法

1. Slack Webhook URLをScriptPropertiesに設定（GASエディタで実行）:
   ```javascript
   setupSlackWebhook('https://hooks.slack.com/services/...');
   ```

2. トリガー設定（GASエディタ）:
   - トリガーを追加 → `onFormSubmit` → スプレッドシートから → フォーム送信時

### 設定項目

`getFormConfig()` 関数内で以下を設定：

| 項目 | 現在の値 |
|------|---------|
| SLACK.CHANNEL | `2025_4q_金8_テクノロジー特論d_人工現実` |
| SHEET.SUBMISSION_TAB_NAME | `DHGSVR25` |
| SHEET.GRADEBOOK_TAB_NAME | `25課題` |

### 年度更新時の作業

新年度が始まったら：
1. `getFormConfig()` のシート名を更新（例: `DHGSVR26`, `26課題`）
2. Slackチャンネル名を更新
3. 管理シートに新年度の学生IDを追加
