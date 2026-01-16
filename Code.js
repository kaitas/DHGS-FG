/**
 * DHGS-FG: Faculty Development用GASプロジェクト
 * スプレッドシート「DHGSVR」と連携
 *
 * 機能:
 * - Web API（シラバス、フォーム、スライド情報取得）
 * - フォーム送信時のSlack通知・成績登録
 */

const SPREADSHEET_ID = '1WPJYZ9CZ2gm5HUToDGTwTs0jbuTCln6Qs924L6iMnDA';

// ========================================
// フォーム処理用設定
// ========================================

/**
 * フォーム処理の設定を取得
 * 機密情報はScriptPropertiesから取得
 */
function getFormConfig() {
  const props = PropertiesService.getScriptProperties();
  return {
    SLACK: {
      WEBHOOK_URL: props.getProperty('SLACK_WEBHOOK_URL') || '',
      CHANNEL: '2025_4q_金8_テクノロジー特論d_人工現実',
      ICON_EMOJI: ':date:',
      BOT_NAME: '課題提出Bot'
    },
    SHEET: {
      URL: `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/`,
      SUBMISSION_TAB_NAME: 'DHGSVR25',  // フォームの回答が入るシート名
      GRADEBOOK_TAB_NAME: '25課題'       // 出席・提出記録簿のシート名
    },
    // メモ欄（Slack通知の明細）から除外する列名リスト
    EXCLUDE_HEADERS: [
      'タイムスタンプ', '氏名', '学籍番号', '講義回', 'Slack公開希望', 'SlidesURL',
      '本日の授業について①', '本日の授業について②感想', 'コメント', '非公開の連絡事項'
    ]
  };
}

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

      case 'readSyllabus':
        // シラバス24/25/26形式専用（B列が項目名、C列以降がデータ）
        const syllabusSheet = params.sheet;
        if (!syllabusSheet) {
          return jsonResponse({ error: 'sheet parameter required' }, 400);
        }
        const syllabusData = getSyllabusData(syllabusSheet);
        if (syllabusData === null) {
          return jsonResponse({ error: 'Sheet not found or not allowed' }, 404);
        }
        return jsonResponse(syllabusData);

      case 'updateSyllabus26':
        // シラバス26を更新
        const updateResult = updateSyllabus26Api();
        return jsonResponse(updateResult);

      case 'forms':
        // リンクされているフォーム一覧
        return jsonResponse(getLinkedFormsApi());

      case 'formStructure':
        // フォームの構造を取得
        const formId = params.formId;
        if (!formId) {
          return jsonResponse({ error: 'formId parameter required' }, 400);
        }
        const formData = getFormStructureApi(formId);
        if (formData === null) {
          return jsonResponse({ error: 'Form not found or not accessible' }, 404);
        }
        return jsonResponse(formData);

      case 'slides':
        // スライドの内容を取得
        const slideId = params.slideId;
        if (!slideId) {
          return jsonResponse({ error: 'slideId parameter required' }, 400);
        }
        const slideData = getSlidesApi(slideId);
        if (slideData === null) {
          return jsonResponse({ error: 'Slides not found or not accessible' }, 404);
        }
        return jsonResponse(slideData);

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

/**
 * シラバス24/25/26形式のデータ取得
 * B列が項目名、C列以降がデータの形式に対応
 */
function getSyllabusData(sheetName) {
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
    return { sheetName: sheetName, syllabus: {} };
  }

  // 全データを取得
  const allData = sheet.getRange(1, 1, lastRow, lastCol).getValues();

  // シラバスデータを構造化
  const syllabus = {
    sheetName: sheetName,
    format: 'syllabus_v2', // 24/25/26形式
    basic: {},
    lectures: [],
    evaluation: {}
  };

  // B列（インデックス1）を項目名として読み取り
  for (let i = 0; i < allData.length; i++) {
    const itemName = String(allData[i][1]).trim(); // B列
    const value = allData[i][2]; // C列（主要データ）
    const extraValues = allData[i].slice(3).filter(v => v !== ''); // D列以降

    // 項目名に基づいて分類
    if (itemName === '科目名') {
      syllabus.basic.courseName = value;
    } else if (itemName === '科目カテゴリ') {
      syllabus.basic.category = value;
    } else if (itemName === '開講時期') {
      syllabus.basic.semester = value;
    } else if (itemName === '担当教員') {
      syllabus.basic.instructor = value;
    } else if (itemName === '授業概要') {
      syllabus.basic.overview = value;
    } else if (itemName === '到達目標') {
      syllabus.basic.objectives = value;
    } else if (itemName === 'キーワード') {
      syllabus.basic.keywords = value;
    } else if (itemName.match(/^第[1-8]回$/)) {
      const lectureNum = parseInt(itemName.replace(/[^0-9]/g, ''));
      // C列: タイトル, D列: 内容（推測）
      const title = allData[i][2] || '';
      const content = allData[i][3] || '';
      syllabus.lectures.push({
        number: lectureNum,
        title: title,
        content: content
      });
    } else if (itemName === '授業形式') {
      syllabus.evaluation.format = value;
    } else if (itemName === '成績評価方法と基準') {
      syllabus.evaluation.grading = value;
    } else if (itemName === '履修条件と留意事項') {
      syllabus.evaluation.prerequisites = value;
    } else if (itemName === '教科書') {
      syllabus.evaluation.textbook = value;
    } else if (itemName === '参考文献') {
      syllabus.evaluation.references = value;
    }
  }

  // lecturesをソート
  syllabus.lectures.sort((a, b) => a.number - b.number);

  return syllabus;
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

/**
 * スライドAPIのテスト（権限付与用）
 */
function testSlides() {
  const result = getSlidesApi('115gBQJ9xHQ0_TPVZEtjtfhhVxCbP528rVOpTl-WddC0');
  console.log(JSON.stringify(result, null, 2));
}

// ========================================
// フォーム・スライド アクセス用関数
// ========================================

// 許可されたスライドID（講義準備用）
const ALLOWED_SLIDE_IDS = [
  '115gBQJ9xHQ0_TPVZEtjtfhhVxCbP528rVOpTl-WddC0' // DHGSVR25-講義準備
];

/**
 * API用: リンクされているフォーム一覧
 */
function getLinkedFormsApi() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheets = ss.getSheets();

  const linkedForms = [];

  sheets.forEach(sheet => {
    const formUrl = sheet.getFormUrl();
    if (formUrl) {
      // フォームIDを抽出
      const match = formUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
      const formId = match ? match[1] : null;

      linkedForms.push({
        sheetName: sheet.getName(),
        formUrl: formUrl,
        formId: formId
      });
    }
  });

  return {
    spreadsheetName: ss.getName(),
    linkedForms: linkedForms
  };
}

/**
 * API用: フォームの構造を取得
 */
function getFormStructureApi(formId) {
  try {
    const form = FormApp.openById(formId);
    const items = form.getItems();

    return {
      title: form.getTitle(),
      description: form.getDescription(),
      id: form.getId(),
      publishedUrl: form.getPublishedUrl(),
      itemCount: items.length,
      items: items.map(item => {
        const itemData = {
          id: item.getId(),
          title: item.getTitle(),
          type: item.getType().toString(),
          helpText: item.getHelpText()
        };

        // 選択肢がある場合は取得
        if (item.getType() === FormApp.ItemType.MULTIPLE_CHOICE) {
          const mcItem = item.asMultipleChoiceItem();
          itemData.choices = mcItem.getChoices().map(c => c.getValue());
        } else if (item.getType() === FormApp.ItemType.LIST) {
          const listItem = item.asListItem();
          itemData.choices = listItem.getChoices().map(c => c.getValue());
        } else if (item.getType() === FormApp.ItemType.CHECKBOX) {
          const cbItem = item.asCheckboxItem();
          itemData.choices = cbItem.getChoices().map(c => c.getValue());
        }

        return itemData;
      })
    };
  } catch (e) {
    console.log('Form access error: ' + e.message);
    return null;
  }
}

/**
 * API用: スライドの内容を取得
 */
function getSlidesApi(slideId) {
  // 許可されたスライドのみアクセス可能
  if (!ALLOWED_SLIDE_IDS.includes(slideId)) {
    return null;
  }

  try {
    const presentation = SlidesApp.openById(slideId);
    const slides = presentation.getSlides();

    return {
      title: presentation.getName(),
      id: presentation.getId(),
      url: presentation.getUrl(),
      slideCount: slides.length,
      slides: slides.map((slide, index) => {
        const shapes = slide.getShapes();
        const textContent = [];

        shapes.forEach(shape => {
          if (shape.getText()) {
            const text = shape.getText().asString().trim();
            if (text) {
              textContent.push(text);
            }
          }
        });

        return {
          slideNumber: index + 1,
          slideId: slide.getObjectId(),
          textContent: textContent
        };
      })
    };
  } catch (e) {
    console.log('Slides access error: ' + e.message);
    return null;
  }
}

/**
 * スプレッドシートにリンクされているフォームを取得
 */
function getLinkedForms() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheets = ss.getSheets();

  const linkedForms = [];

  sheets.forEach(sheet => {
    const formUrl = sheet.getFormUrl();
    if (formUrl) {
      linkedForms.push({
        sheetName: sheet.getName(),
        formUrl: formUrl
      });
    }
  });

  console.log('=== リンクされているフォーム ===');
  console.log(JSON.stringify(linkedForms, null, 2));

  return linkedForms;
}

/**
 * フォームの構造を取得
 */
function getFormStructure(formUrl) {
  try {
    const form = FormApp.openByUrl(formUrl);
    const items = form.getItems();

    const structure = {
      title: form.getTitle(),
      description: form.getDescription(),
      id: form.getId(),
      editUrl: form.getEditUrl(),
      publishedUrl: form.getPublishedUrl(),
      items: items.map(item => ({
        id: item.getId(),
        title: item.getTitle(),
        type: item.getType().toString(),
        helpText: item.getHelpText()
      }))
    };

    console.log('=== フォーム構造 ===');
    console.log(JSON.stringify(structure, null, 2));

    return structure;
  } catch (e) {
    console.log('Error: ' + e.message);
    return { error: e.message };
  }
}

// ========================================
// フォーム送信時の処理（トリガー用）
// ========================================

/**
 * フォーム送信時にトリガーされるメイン関数
 * スプレッドシートのトリガーとして設定してください
 */
function onFormSubmit(e) {
  const CONFIG = getFormConfig();

  try {
    // 1. 最新の回答データを取得（ヘッダー名をキーとしたオブジェクトとして取得）
    const submission = getLatestSubmission(CONFIG);
    if (!submission) {
      console.warn('データが見つかりませんでした。');
      return;
    }

    // 2. データの整理
    const data = {
      name: submission['氏名'] || '不明',
      id: submission['学籍番号'] || 'unknown',
      unit: submission['講義回'] || 'test',
      slidesUrl: submission['SlidesURL'] || '',
      isAnonymous: submission['Slack公開希望'] === '公開を希望しない' || submission['Slack公開希望'] === '(全体を)Slack投稿しない',
      feedback: extractFeedback(submission),
      memo: generateDynamicMemo(submission, CONFIG)
    };

    // 3. Slack投稿用の本文作成
    let messageBody = '';
    const baseText = '`課題提出` ';
    const reporterInfo = data.isAnonymous ? '(公開を希望しない)' : `${data.name} (${data.id})`;

    messageBody = `${baseText} by ${reporterInfo} 講義回:${data.unit}\n`;
    messageBody += `${data.feedback}\n${data.memo}\n`;

    if (data.slidesUrl) {
      messageBody += `<${data.slidesUrl}|GoogleSlides>\n`;
    }

    // 4. Slackへ送信 (「Slack投稿しない」以外の場合)
    if (submission['Slack公開希望'] !== '(全体を)Slack投稿しない') {
      postToSlack(messageBody, data.isAnonymous ? '課題提出Bot (匿名)' : data.name, CONFIG);
    } else {
      console.log('Slack投稿はスキップされました。');
    }

    // 5. 成績表（管理シート）への登録
    registerAssignment(data.id, data.unit, messageBody, CONFIG);

  } catch (error) {
    console.error('エラーが発生しました: ' + error.stack);
  }
}

/**
 * シートの最終行（最新の回答）を取得し、
 * { "列ヘッダー名": "値", ... } の形式で返す
 */
function getLatestSubmission(CONFIG) {
  const sheet = SpreadsheetApp.openByUrl(CONFIG.SHEET.URL).getSheetByName(CONFIG.SHEET.SUBMISSION_TAB_NAME);
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if (lastRow < 2) return null;

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const values = sheet.getRange(lastRow, 1, 1, lastCol).getValues()[0];

  const submissionData = {};
  for (let i = 0; i < headers.length; i++) {
    submissionData[headers[i]] = values[i];
  }
  return submissionData;
}

/**
 * 共通のフィードバック項目（感想など）を抽出・整形
 */
function extractFeedback(submission) {
  let text = '';
  const feedbackKeys = ['本日の授業について①', '本日の授業について②感想', 'コメント'];

  feedbackKeys.forEach(key => {
    if (submission[key]) {
      text += `*${key}*: ${submission[key]}\n`;
    }
  });
  return text;
}

/**
 * 課題固有の項目を自動判別してメモを作成
 * URLならリンク化、それ以外はテキスト表示
 */
function generateDynamicMemo(submission, CONFIG) {
  let memo = '';

  for (const [key, value] of Object.entries(submission)) {
    if (!value || CONFIG.EXCLUDE_HEADERS.includes(key)) continue;

    const isUrl = /^https?:\/\//.test(String(value).trim());

    if (isUrl) {
      memo += `- <${value}|${key}>\n`;
    } else {
      memo += `- *${key}*: ${value}\n`;
    }
  }
  return memo;
}

/**
 * Slackへの送信処理
 */
function postToSlack(body, username, CONFIG) {
  if (!CONFIG.SLACK.WEBHOOK_URL) {
    console.error('Slack Webhook URLが設定されていません。ScriptPropertiesにSLACK_WEBHOOK_URLを設定してください。');
    return;
  }

  const payload = {
    channel: CONFIG.SLACK.CHANNEL,
    username: username,
    text: body,
    icon_emoji: CONFIG.SLACK.ICON_EMOJI,
    mrkdwn: true,
    unfurl_links: true
  };

  const options = {
    method: 'POST',
    contentType: 'application/json',
    payload: JSON.stringify(payload)
  };

  UrlFetchApp.fetch(CONFIG.SLACK.WEBHOOK_URL, options);
}

/**
 * 提出管理シートへの登録処理
 */
function registerAssignment(studentId, unitString, noteText, CONFIG) {
  const ss = SpreadsheetApp.openByUrl(CONFIG.SHEET.URL);
  const sheet = ss.getSheetByName(CONFIG.SHEET.GRADEBOOK_TAB_NAME);

  // 講義回から数字のみ抽出 (例: "#1遅延" -> 1)
  const unitMatch = unitString.match(/\d+/);
  if (!unitMatch) {
    console.error(`講義回番号が判別できません: ${unitString}`);
    return;
  }
  const unitNum = parseInt(unitMatch[0], 10);

  // 学籍番号を検索 (TextFinderを使用し高速化)
  const idColumn = sheet.getRange('A:A');
  const finder = idColumn.createTextFinder(studentId).matchEntireCell(true);
  const result = finder.findNext();

  if (result) {
    const row = result.getRow();
    const targetCol = 4 + unitNum;

    const cell = sheet.getRange(row, targetCol);
    cell.setValue(new Date());
    cell.setNote(noteText);
    console.log(`ID: ${studentId} (Unit: ${unitNum}) を登録しました。`);
  } else {
    console.warn(`ID: ${studentId} が管理シートで見つかりませんでした。`);
  }
}

// ========================================
// セットアップ用関数
// ========================================

/**
 * Slack Webhook URLをScriptPropertiesに設定
 * 初回セットアップ時に実行
 * @param {string} webhookUrl - Slack Webhook URL
 */
function setupSlackWebhook(webhookUrl) {
  if (!webhookUrl) {
    console.error('Webhook URLを引数に指定してください');
    return;
  }
  PropertiesService.getScriptProperties().setProperty('SLACK_WEBHOOK_URL', webhookUrl);
  console.log('Slack Webhook URL has been set.');
}

/**
 * フォームトリガーをテスト（手動実行用）
 */
function testFormSubmit() {
  onFormSubmit({});
}

// ========================================
// シラバス書き込み関数
// ========================================

/**
 * シラバス26の更新データ
 */
const SYLLABUS26_DATA = {
  '授業概要': '「人工現実」とは頭の中にある現実を人工的に作り出す能力である。本講義ではAR/VR/メタバースや生成AIの技術史を俯瞰した上で、コーディングエージェントを活用したインタラクティブコンテンツ制作、アバターを使った動画制作と発信を実践する。毎週の課題を通して想像を実装し社会に共有する力を習得する。',

  '成績評価方法と基準': '5段階評価（S〜D）\n単位取得の前提条件：毎回の課題をすべて提出していること。\n（1）最終レポート：技術史理解と社会実装への考察（30%）\n（2）アバター動画制作および発信（30%）\n（3）インタラクティブコンテンツの制作とデプロイ（30%）\n（4）授業への貢献：発言、相互評価、知識共有（10%）',

  '履修条件と留意事項': '本講義は演習としてSNSやクラウドサービスをアカウント作成から行い、双方向コミュニケーションおよび発信活動を行う。これらの通信環境や利用規約に同意できない場合は本講義の履修を断念するか、代替手段を担当教員に事前提案の上履修すること。',

  '教科書': 'なし',

  '参考文献': 'AIとコラボして神絵師になる 論文から読み解くStable Diffusion／白井暁彦／インプレスR&D／ISBN：978-4295601388\nバーチャルリアリティ学／日本バーチャルリアリティ学会編／コロナ社／ISBN：978-4904490051'
};

/**
 * シラバス26を更新する（API用）
 */
function updateSyllabus26Api() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('シラバス26');

    if (!sheet) {
      return { success: false, error: 'シラバス26シートが見つかりません' };
    }

    const lastRow = sheet.getLastRow();
    const bColumn = sheet.getRange('B1:B' + lastRow).getValues();
    const updated = [];

    for (const [fieldName, value] of Object.entries(SYLLABUS26_DATA)) {
      for (let i = 0; i < bColumn.length; i++) {
        if (bColumn[i][0] === fieldName) {
          sheet.getRange(i + 1, 3).setValue(value);
          updated.push({ field: fieldName, row: i + 1 });
          break;
        }
      }
    }

    return {
      success: true,
      message: 'シラバス26を更新しました',
      updated: updated
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * シラバス26を更新する（手動実行用）
 */
function updateSyllabus26() {
  const result = updateSyllabus26Api();
  console.log(JSON.stringify(result, null, 2));
}

/**
 * シラバスの特定項目を更新（汎用）
 */
function updateSyllabusField(sheetName, fieldName, value) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    console.error(`${sheetName}シートが見つかりません`);
    return false;
  }

  const lastRow = sheet.getLastRow();
  const bColumn = sheet.getRange('B1:B' + lastRow).getValues();

  for (let i = 0; i < bColumn.length; i++) {
    if (bColumn[i][0] === fieldName) {
      sheet.getRange(i + 1, 3).setValue(value);
      console.log(`更新: ${sheetName} - ${fieldName}`);
      return true;
    }
  }

  console.error(`${fieldName}が見つかりません`);
  return false;
}
