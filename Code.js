/**
 * DHGS-FG: Faculty Development用GASプロジェクト
 * スプレッドシート「DHGSVR」と連携
 */

const SPREADSHEET_ID = '1WPJYZ9CZ2gm5HUToDGTwTs0jbuTCln6Qs924L6iMnDA';

// ========================================
// Web API エンドポイント（セキュア）
// ========================================

/**
 * GETリクエストハンドラ
 * @param {Object} e - リクエストパラメータ
 *
 * 使用方法:
 *   ?key=API_KEY&action=list              - 許可されたシート一覧
 *   ?key=API_KEY&action=read&sheet=NAME   - 特定シートの内容取得
 *   ?key=API_KEY&action=all               - 全シート情報（メタデータのみ）
 */
function doGet(e) {
  try {
    const params = e.parameter;

    // APIキー認証
    const apiKey = PropertiesService.getScriptProperties().getProperty('API_KEY');
    if (!apiKey || params.key !== apiKey) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const action = params.action;

    switch (action) {
      case 'list':
        return jsonResponse(listAllowedSheets());

      case 'all':
        return jsonResponse(getAllSheetsMetadata());

      case 'read':
        const sheetName = params.sheet;
        if (!sheetName) {
          return jsonResponse({ error: 'sheet parameter required' }, 400);
        }
        const data = getSheetDataSecure(sheetName);
        if (data === null) {
          return jsonResponse({ error: 'Sheet not found or not allowed' }, 404);
        }
        return jsonResponse(data);

      default:
        return jsonResponse({
          error: 'Invalid action',
          available: ['list', 'all', 'read']
        }, 400);
    }
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
}

/**
 * JSONレスポンスを生成
 */
function jsonResponse(data, statusCode = 200) {
  const output = ContentService.createTextOutput(JSON.stringify(data, null, 2));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

/**
 * 許可されたシート一覧を取得
 * シラバス関連シートのみを公開
 */
function listAllowedSheets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheets = ss.getSheets();

  const allowedSheets = sheets
    .filter(sheet => isSheetAllowed(sheet.getName()))
    .map(sheet => ({
      name: sheet.getName(),
      gid: sheet.getSheetId(),
      rows: sheet.getLastRow(),
      cols: sheet.getLastColumn()
    }));

  return {
    spreadsheetName: ss.getName(),
    allowedSheets: allowedSheets
  };
}

/**
 * 全シートのメタデータを取得（ヘッダー含む）
 */
function getAllSheetsMetadata() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheets = ss.getSheets();

  const sheetInfoList = sheets.map((sheet, index) => {
    const name = sheet.getName();
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();

    let headers = [];
    if (lastRow > 0 && lastCol > 0) {
      headers = sheet.getRange(1, 1, 1, Math.min(lastCol, 15)).getValues()[0]
        .filter(h => h !== '');
    }

    return {
      index: index + 1,
      name: name,
      gid: sheet.getSheetId(),
      rows: lastRow,
      cols: lastCol,
      headers: headers,
      allowed: isSheetAllowed(name)
    };
  });

  return {
    spreadsheetName: ss.getName(),
    totalSheets: sheets.length,
    sheets: sheetInfoList
  };
}

/**
 * シートが読み取り許可されているかチェック
 * 個人情報を含まないシートのみ許可
 */
function isSheetAllowed(sheetName) {
  // シラバス関連のシートを許可（パターンマッチ）
  const allowedPatterns = [
    /^シラバス/,           // シラバス系
    /^講義/,               // 講義系
    /^カリキュラム/,       // カリキュラム系
    /^スケジュール/,       // スケジュール系
    /^設定$/,              // 設定シート
    /^マスタ/,             // マスタデータ
  ];

  // 明示的に禁止するシート（個人情報含む）
  const deniedPatterns = [
    /学生/,
    /名簿/,
    /連絡先/,
    /成績/,
    /個人/,
    /メール/,
    /住所/,
  ];

  // 禁止パターンに一致したら拒否
  if (deniedPatterns.some(pattern => pattern.test(sheetName))) {
    return false;
  }

  // 許可パターンに一致したら許可
  if (allowedPatterns.some(pattern => pattern.test(sheetName))) {
    return true;
  }

  // デフォルトは拒否（ホワイトリスト方式）
  return false;
}

/**
 * セキュアなシートデータ取得
 * 許可されたシートのみ読み取り可能
 */
function getSheetDataSecure(sheetName) {
  if (!isSheetAllowed(sheetName)) {
    return null;
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    return null;
  }

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if (lastRow === 0 || lastCol === 0) {
    return { sheetName: sheetName, headers: [], data: [] };
  }

  const data = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  const headers = data[0];
  const rows = data.slice(1);

  return {
    sheetName: sheetName,
    headers: headers,
    rowCount: rows.length,
    data: rows.map(row => {
      const obj = {};
      headers.forEach((h, i) => {
        if (h) obj[h] = row[i];
      });
      return obj;
    })
  };
}

// ========================================
// ローカル実行用関数
// ========================================

/**
 * 全シートの情報を取得してログ出力
 */
function getAllSheetsInfo() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheets = ss.getSheets();

  console.log('=== スプレッドシート情報 ===');
  console.log(`名前: ${ss.getName()}`);
  console.log(`URL: ${ss.getUrl()}`);
  console.log(`シート数: ${sheets.length}`);
  console.log('');

  sheets.forEach((sheet, index) => {
    const name = sheet.getName();
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    const gid = sheet.getSheetId();

    let headers = [];
    if (lastRow > 0 && lastCol > 0) {
      headers = sheet.getRange(1, 1, 1, Math.min(lastCol, 10)).getValues()[0];
    }

    console.log(`[${index + 1}] ${name} ${isSheetAllowed(name) ? '✓' : '✗'}`);
    console.log(`    GID: ${gid}`);
    console.log(`    サイズ: ${lastRow}行 x ${lastCol}列`);
    console.log(`    ヘッダー: ${headers.filter(h => h !== '').slice(0, 5).join(', ')}`);
    console.log('');
  });
}

/**
 * APIキーを生成してScriptPropertiesに設定
 * 初回セットアップ時に1回だけ実行
 */
function setupApiKey() {
  const key = Utilities.getUuid();
  PropertiesService.getScriptProperties().setProperty('API_KEY', key);
  console.log('API Key has been set. Check Script Properties to retrieve it.');
  console.log('Key: ' + key);
}
