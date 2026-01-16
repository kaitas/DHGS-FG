# DHGS-FG

デジタルハリウッド大学大学院「テクノロジー特論D（人工現実）」の授業運営（Faculty Development）を支援するGoogle Apps Scriptプロジェクト。

## 概要

- **科目名**: テクノロジー特論D（人工現実）
- **科目カテゴリ**: 専門 / 実践・応用
- **開講時期**: 4Q 水曜日 8限
- **単位数**: 1単位

## リンク

| リソース | URL |
|---------|-----|
| スプレッドシート | [DHGS](https://docs.google.com/spreadsheets/d/1WPJYZ9CZ2gm5HUToDGTwTs0jbuTCln6Qs924L6iMnDA/edit) |
| GASスクリプトエディタ | [Apps Script](https://script.google.com/home/projects/1HvfDdtHGDAhhQceaODn-DRuU7hhtgMCuE7Fj7fP6Vo2FG7E4ypqWYn03/edit) |

## 重要: コード管理について

**GASスクリプトエディタで直接コードを編集しないでください。**

このプロジェクトは `clasp` を使用してGitリポジトリから管理しています。

- コード変更は必ずこのリポジトリで行う
- `clasp push` でGASに反映
- スクリプトエディタでの直接編集は `clasp pull` で上書きされる可能性がある

## スプレッドシート構成

スプレッドシート「DHGS」は29シートで構成されています。

### シラバス系（API経由でアクセス可能）

| シート名 | 行数 | 列数 | 説明 |
|---------|------|------|------|
| シラバス26 | 28 | 10 | 2026年度シラバス（作成中） |
| シラバス25 | 28 | 10 | 2025年度シラバス |
| シラバス24 | 28 | 10 | 2024年度シラバス |
| シラバス23 | 20 | 14 | 2023年度シラバス（実績あり） |
| シラバス22 | 82 | 9 | 2022年度シラバス |
| シラバス21 | 50 | 9 | 2021年度シラバス |

### 受講者・課題系（個人情報のためAPI非公開）

| シート名 | 説明 |
|---------|------|
| 25受講者, 24受講者, 23受講者, 22受講者 | 年度別受講者名簿 |
| 25課題, 24課題, 23課題, 22課題, 21課題 | 年度別課題提出状況 |
| 23成績, 23出席, 22出席new | 成績・出席記録 |

### 講義記録系（個人情報のためAPI非公開）

| シート名 | 行数 | 説明 |
|---------|------|------|
| DHGSVR25 | 78 | 2025年度講義記録 |
| DHGSVR24 | 164 | 2024年度講義記録 |
| DHGSVR23 | 188 | 2023年度講義記録 |
| DHGSVR22 | 153 | 2022年度講義記録 |
| DHGSVR21 | 202 | 2021年度講義記録 |

## 講義内容（2023年度実績）

全8回の講義構成：

| 回 | タイトル | 内容 |
|----|---------|------|
| 1 | 人工現実概論 | 人工現実の現在過去未来 |
| 2 | ジェネレーティブAI | 画像生成AIを体験し、作品制作プロセスを学ぶ |
| 3 | 令和のメタバース | WebXR, NFT, Web3, VTuberのエンゲージメント構築 |
| 4 | メタバース年賀状の試作 | Mozilla Hubsを用いたメタバース空間設計 |
| 5 | メタバース年賀状のデプロイ | Hubs/DOORで年賀状完成 |
| 6 | VTuberを設計する | キャラクター設計シートの作成 |
| 7 | VTuberを発信する | SNSでのリリースとエンゲージメント設計 |
| 8 | 人工現実の未来開発 | 総合まとめと社会実装力の深化 |

## セットアップ

### 前提条件

- Node.js
- clasp (`npm install -g @google/clasp`)
- Google Apps Script APIの有効化: https://script.google.com/home/usersettings

### インストール

```bash
# claspでログイン
clasp login

# プロジェクトをクローン（初回のみ）
clasp clone 1HvfDdtHGDAhhQceaODn-DRuU7hhtgMCuE7Fj7fP6Vo2FG7E4ypqWYn03

# 変更をプッシュ
clasp push -f
```

## セキュリティ

### APIアクセス制御

- **APIキー認証必須**: ScriptPropertiesに保存されたAPIキーで認証
- **ホワイトリスト方式**: `isSheetAllowed()` 関数でシラバス系シートのみアクセス許可
- **個人情報保護**: 学生/名簿/成績/連絡先を含むシートは明示的に拒否

### 機密情報の取り扱い

以下の情報は公開リポジトリにコミットしないこと：

| ファイル/情報 | 説明 | 対応 |
|-------------|------|------|
| `.clasp.json` | スクリプトID | `.gitignore`で除外済み |
| APIキー | GAS認証用 | ScriptPropertiesに保存、コードに埋め込まない |
| 個人情報 | 学生データ | APIでアクセス不可、手動でも取り扱い注意 |

### デプロイ時の注意

ウェブアプリのデプロイ設定：
- 実行ユーザー: `自分`（スプレッドシートのオーナー権限で実行）
- アクセス: `全員`（APIキーで保護）

## API

GASウェブアプリとしてデプロイ済み。

### エンドポイント

```
GET ?key=API_KEY&action=all    # 全シートメタデータ取得
GET ?key=API_KEY&action=list   # 許可シート一覧
GET ?key=API_KEY&action=read&sheet=シラバス23  # シート内容取得
```

### 使用例

```bash
# 日本語パラメータはURLエンコードが必要
curl -sL --get "https://script.google.com/macros/s/.../exec" \
  --data-urlencode "key=YOUR_API_KEY" \
  --data-urlencode "action=read" \
  --data-urlencode "sheet=シラバス23"
```

## ファイル構成

```
DHGS-FG/
├── Code.js           # メインGASスクリプト
├── appsscript.json   # GASマニフェスト
├── .clasp.json       # clasp設定（.gitignore対象）
├── .gitignore
├── README.md
└── AGENTS.md         # AIエージェント向けガイド
```

## 参考文献

- 「AIとコラボして神絵師になる 論文から読み解くStable Diffusion」白井暁彦 / インプレスR&D
- 「白井博士の未来のゲームデザイン -エンターテインメントシステムの科学-」白井暁彦 / ワークスコーポレーション
- 「バーチャルリアリティ学」日本バーチャルリアリティ学会 / コロナ社
