#!/usr/bin/env python3
"""
Form2Json.py - Google Formの構造をJSON形式で保存するスクリプト

使用方法:
    python Form2Json.py                    # デフォルトのフォームを今日の日付で保存
    python Form2Json.py --date 250116      # 日付を指定
    python Form2Json.py --form-id XXXXX    # フォームIDを指定
    python Form2Json.py --list             # リンクされているフォーム一覧を表示
"""

import json
import urllib.request
import urllib.parse
import argparse
from datetime import datetime
from pathlib import Path

# API設定
BASE_URL = "https://script.google.com/macros/s/AKfycbwu4-Wrh_qhtx9LumtcPXEIEWJuQ3hzBtgN3uatcq2leXUtE2qMziKW61wqnkPMYCNpLA/exec"
API_KEY = "387dce93-d339-463a-9dcb-8b88da377fe6"

# デフォルトのフォームID (DHGSVR25)
DEFAULT_FORM_ID = "1pn6aehi-wX_Zw5bW7UzrJfE6VIhLsYrxyrHqS46eYx0"

# 出力ディレクトリ
OUTPUT_DIR = Path(__file__).parent / "forms"


def api_request(action: str, **params) -> dict:
    """APIリクエストを実行"""
    params["key"] = API_KEY
    params["action"] = action

    query = urllib.parse.urlencode(params)
    url = f"{BASE_URL}?{query}"

    with urllib.request.urlopen(url) as response:
        return json.loads(response.read().decode("utf-8"))


def list_forms() -> list:
    """リンクされているフォーム一覧を取得"""
    result = api_request("forms")
    return result.get("linkedForms", [])


def get_form_structure(form_id: str) -> dict:
    """フォーム構造を取得"""
    return api_request("formStructure", formId=form_id)


def save_form_json(form_data: dict, filename: str) -> Path:
    """フォームデータをJSONとして保存"""
    OUTPUT_DIR.mkdir(exist_ok=True)

    filepath = OUTPUT_DIR / filename
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(form_data, f, ensure_ascii=False, indent=2)

    return filepath


def generate_filename(prefix: str = "DHGSVR", date_str: str = None) -> str:
    """ファイル名を生成"""
    if date_str is None:
        date_str = datetime.now().strftime("%y%m%d")
    return f"{prefix}{date_str}.json"


def main():
    parser = argparse.ArgumentParser(
        description="Google Formの構造をJSON形式で保存"
    )
    parser.add_argument(
        "--list", "-l",
        action="store_true",
        help="リンクされているフォーム一覧を表示"
    )
    parser.add_argument(
        "--form-id", "-f",
        default=DEFAULT_FORM_ID,
        help=f"フォームID (デフォルト: {DEFAULT_FORM_ID})"
    )
    parser.add_argument(
        "--date", "-d",
        help="日付文字列 (例: 250116)。省略時は今日の日付"
    )
    parser.add_argument(
        "--prefix", "-p",
        default="DHGSVR",
        help="ファイル名のプレフィックス (デフォルト: DHGSVR)"
    )
    parser.add_argument(
        "--output", "-o",
        help="出力ファイルパス (指定時は --date, --prefix を無視)"
    )

    args = parser.parse_args()

    # フォーム一覧表示モード
    if args.list:
        print("リンクされているフォーム一覧:")
        print("-" * 60)
        for form in list_forms():
            print(f"  シート: {form['sheetName']}")
            print(f"  フォームID: {form['formId']}")
            print(f"  URL: {form['formUrl']}")
            print()
        return

    # フォーム構造を取得
    print(f"フォームID: {args.form_id}")
    print("フォーム構造を取得中...")

    try:
        form_data = get_form_structure(args.form_id)
    except Exception as e:
        print(f"エラー: フォーム構造の取得に失敗しました: {e}")
        return 1

    if "error" in form_data:
        print(f"エラー: {form_data['error']}")
        return 1

    # ファイル名を決定
    if args.output:
        filepath = Path(args.output)
        filepath.parent.mkdir(parents=True, exist_ok=True)
    else:
        filename = generate_filename(args.prefix, args.date)
        filepath = save_form_json(form_data, filename)

    # 保存
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(form_data, f, ensure_ascii=False, indent=2)

    print(f"保存完了: {filepath}")
    print(f"  タイトル: {form_data.get('title', 'N/A')}")
    print(f"  設問数: {form_data.get('itemCount', 'N/A')}")

    return 0


if __name__ == "__main__":
    exit(main())
