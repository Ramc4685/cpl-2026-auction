const STATE_SHEET = "State";
const LOG_SHEET = "Auction Log";

function doGet(e) {
  const params = (e && e.parameter) || {};
  const payload = {
    ok: true,
    state: readState_(),
    serverTime: new Date().toISOString()
  };

  const output = JSON.stringify(payload);
  if (params.callback) {
    return ContentService
      .createTextOutput(params.callback + "(" + output + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(output)
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const key = adminKey_();
    if (!key || body.key !== key) {
      return json_({ ok: false, error: "Invalid admin key" });
    }

    if (!body.state || typeof body.state !== "object") {
      return json_({ ok: false, error: "Missing state" });
    }

    writeState_(body.state);
    return json_({ ok: true, revision: body.state.revision || 0 });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function readState_() {
  const sheet = getStateSheet_();
  const raw = sheet.getRange("A2").getValue();
  if (!raw) {
    return {
      sold: {},
      unsold: {},
      log: [],
      audit: [],
      currentLot: null,
      revision: 0,
      updatedAt: null
    };
  }
  return JSON.parse(raw);
}

function writeState_(state) {
  const sheet = getStateSheet_();
  sheet.getRange("A1").setValue("state_json");
  sheet.getRange("A2").setValue(JSON.stringify(state));
  sheet.getRange("B1").setValue("updated_at");
  sheet.getRange("B2").setValue(new Date().toISOString());
  writeLog_(state.log || []);
}

function getStateSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(STATE_SHEET);
  if (!sheet) sheet = ss.insertSheet(STATE_SHEET);
  return sheet;
}

function writeLog_(log) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(LOG_SHEET);
  if (!sheet) sheet = ss.insertSheet(LOG_SHEET);
  sheet.clearContents();
  sheet.getRange(1, 1, 1, 7).setValues([[
    "Lot",
    "Action",
    "Player",
    "Team",
    "Points",
    "Updated",
    "Note"
  ]]);

  if (!log.length) return;

  const rows = log.map(function(entry) {
    return [
      entry.n || "",
      entry.action || "",
      entry.player || "",
      entry.team || "",
      entry.pts || "",
      entry.correctedAt || entry.ts || "",
      entry.note || ""
    ];
  });
  sheet.getRange(2, 1, rows.length, 7).setValues(rows);
}

function json_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function adminKey_() {
  return PropertiesService.getScriptProperties().getProperty("ADMIN_KEY") || "";
}
