# forms/ - フォーム構造バックアップ

このディレクトリにはGoogle Formの構造をJSON形式でバックアップしたファイルが保存されています。

## ファイル命名規則

```
DHGSVR{YYMMDD}.json
```

- `DHGSVR`: プレフィックス（講義名）
- `YYMMDD`: バックアップ日付（例: 250116 = 2025年1月16日）

## バックアップの取得

```bash
# 今日の日付でバックアップ
python3 Form2Json.py

# 日付を指定してバックアップ
python3 Form2Json.py --date 250116

# 別のフォームをバックアップ
python3 Form2Json.py --form-id FORM_ID --prefix OtherForm
```

## JSONファイルの構造

```json
{
  "title": "フォームタイトル",
  "description": "フォームの説明文",
  "id": "フォームID",
  "publishedUrl": "公開URL",
  "itemCount": 71,
  "items": [
    {
      "id": 1656179519,
      "title": "設問タイトル",
      "type": "TEXT|PARAGRAPH_TEXT|MULTIPLE_CHOICE|CHECKBOX|LIST|...",
      "helpText": "ヘルプテキスト",
      "choices": ["選択肢1", "選択肢2", ...]  // 選択式の場合のみ
    }
  ]
}
```

## 設問タイプ一覧

| タイプ | 説明 |
|--------|------|
| TEXT | 短文回答 |
| PARAGRAPH_TEXT | 長文回答 |
| MULTIPLE_CHOICE | ラジオボタン（単一選択） |
| CHECKBOX | チェックボックス（複数選択） |
| LIST | ドロップダウン |
| PAGE_BREAK | ページ区切り |
| SECTION_HEADER | セクションヘッダー |

## フォームの復元方法

### 方法1: 手動復元（推奨）

JSONファイルを参照しながらGoogle Formsで手動で再作成します。

1. [Google Forms](https://docs.google.com/forms) で新規フォームを作成
2. JSONの `items` 配列を順に参照
3. 各 `type` に応じた設問を追加
4. `title`, `helpText`, `choices` を入力

### 方法2: GAS (FormApp) での復元

Code.js に以下のような関数を追加して実行：

```javascript
function restoreFormFromJson() {
  const jsonData = /* JSONデータ */;
  const form = FormApp.create(jsonData.title);
  form.setDescription(jsonData.description);

  jsonData.items.forEach(item => {
    switch (item.type) {
      case 'TEXT':
        form.addTextItem()
          .setTitle(item.title)
          .setHelpText(item.helpText);
        break;
      case 'MULTIPLE_CHOICE':
        const mcItem = form.addMultipleChoiceItem()
          .setTitle(item.title)
          .setHelpText(item.helpText);
        if (item.choices) {
          mcItem.setChoiceValues(item.choices);
        }
        break;
      // ... 他のタイプも同様
    }
  });

  console.log('復元完了: ' + form.getEditUrl());
}
```

### 方法3: Google Forms API (batchUpdate)

Google Forms APIを使用した自動復元。OAuth 2.0認証が必要。

```bash
# API エンドポイント
POST https://forms.googleapis.com/v1/forms/{formId}:batchUpdate

# リクエストボディ
{
  "requests": [
    {
      "createItem": {
        "item": {
          "title": "設問タイトル",
          "questionItem": {
            "question": {
              "textQuestion": {}
            }
          }
        },
        "location": {"index": 0}
      }
    }
  ]
}
```

詳細: https://developers.google.com/forms/api/reference/rest/v1/forms/batchUpdate

## 注意事項

- **フォームIDは復元不可**: 新規作成時に新しいIDが割り当てられる
- **回答データは含まない**: 構造のみのバックアップ
- **スプレッドシートリンク**: 復元後に手動で再設定が必要
- **トリガー設定**: 復元後に手動で再設定が必要

## 関連ファイル

- `Form2Json.py` - バックアップ取得スクリプト
- `Json2Form.py` - 復元スクリプト（未実装）
- `Code.js` - GAS側でのフォーム操作関数
