const STATE_SHEET = "State";
const LOG_SHEET = "Auction Log";
const SUMMARY_SHEET = "League Summary";
const POOL_SHEET = "Player Pool";
const TOTAL_PURSE = 140000;
const CAPS = { Gold: 3, Silver: 5, Bronze: 7 };

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

    writeState_(body.state, body.data || null);
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

function writeState_(state, data) {
  const sheet = getStateSheet_();
  sheet.getRange("A1").setValue("state_json");
  sheet.getRange("A2").setValue(JSON.stringify(state));
  sheet.getRange("B1").setValue("updated_at");
  sheet.getRange("B2").setValue(new Date().toISOString());
  writeLog_(state.log || []);
  if (data && data.teams && data.retained && data.pool) {
    writeReadableSheets_(state, data);
  }
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

function writeReadableSheets_(state, data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sold = state.sold || {};
  const unsold = state.unsold || {};
  const poolByName = {};
  (data.pool || []).forEach(function(player) {
    poolByName[player.player] = player;
  });

  const summaryRows = [[
    "Team",
    "Purse",
    "Spent",
    "Gold",
    "Silver",
    "Bronze",
    "Total",
    "Slots Left",
    "Required Reserve"
  ]];

  (data.teams || []).forEach(function(team) {
    const stats = teamStats_(team, data, sold, poolByName);
    const needs = categoryNeeds_(stats);
    summaryRows.push([
      team,
      stats.purse,
      stats.spend,
      stats.g + "/" + CAPS.Gold,
      stats.s + "/" + CAPS.Silver,
      stats.b + "/" + CAPS.Bronze,
      stats.count + "/15",
      Math.max(0, 15 - stats.count),
      reserveForNeeds_(needs, data)
    ]);
    writeTeamSheet_(ss, team, stats, needs, data);
  });

  writeTable_(getOrCreateSheet_(ss, SUMMARY_SHEET), summaryRows);
  writePoolSheet_(ss, data, sold, unsold);
}

function writeTeamSheet_(ss, team, stats, needs, data) {
  const sheet = getOrCreateSheet_(ss, safeSheetName_(team));
  const rows = [
    ["Team", team, "", "", "", "", "", ""],
    ["Purse", stats.purse, "Spent", stats.spend, "Roster", stats.count + "/15", "Required Reserve", reserveForNeeds_(needs, data)],
    ["Gold", stats.g + "/" + CAPS.Gold, "Silver", stats.s + "/" + CAPS.Silver, "Bronze", stats.b + "/" + CAPS.Bronze, "Slots Left", Math.max(0, 15 - stats.count)],
    [""],
    ["Source", "Player", "Category", "Role", "Spec", "Points", "Lot", "Status"]
  ];

  stats.players
    .sort(function(a, b) {
      return categoryRank_(a.category) - categoryRank_(b.category) || String(a.player).localeCompare(String(b.player));
    })
    .forEach(function(player) {
      rows.push([
        player.source,
        player.player,
        player.category || "",
        player.role || "",
        player.spec || "",
        player.points || "",
        player.lot || "",
        player.status || ""
      ]);
    });

  writeTable_(sheet, rows);
}

function writePoolSheet_(ss, data, sold, unsold) {
  const rows = [[
    "Player",
    "Category",
    "Status",
    "Sold Team",
    "Sold Points",
    "Reg Type",
    "Previous Team",
    "Previous Points",
    "Role",
    "Spec"
  ]];

  (data.pool || []).forEach(function(player) {
    const sale = sold[player.player] || null;
    const status = sale ? "sold" : unsold[player.player] ? "unsold" : "available";
    rows.push([
      player.player || "",
      player.category || "",
      status,
      sale ? sale.team || "" : "",
      sale ? sale.pts || "" : "",
      player.reg_type || "",
      player.prev_team || "",
      player.prev_points || "",
      player.role || "",
      player.spec || ""
    ]);
  });

  writeTable_(getOrCreateSheet_(ss, POOL_SHEET), rows);
}

function teamStats_(team, data, sold, poolByName) {
  const stats = { team: team, g: 0, s: 0, b: 0, count: 0, spend: 0, players: [] };

  (data.retained || []).forEach(function(player) {
    if (player.team !== team || player.status !== "Retained Registered") return;
    addCategory_(stats, player.category);
    stats.count++;
    stats.spend += Number(player.points || 0);
    stats.players.push({
      source: "Retained",
      player: player.player,
      category: player.category,
      role: player.role,
      spec: player.spec,
      points: Number(player.points || 0),
      lot: "",
      status: player.status
    });
  });

  Object.keys(sold || {}).forEach(function(playerName) {
    const sale = sold[playerName];
    if (!sale || sale.team !== team) return;
    const poolPlayer = poolByName[playerName] || {};
    addCategory_(stats, poolPlayer.category);
    stats.count++;
    stats.spend += Number(sale.pts || 0);
    stats.players.push({
      source: "Auction",
      player: playerName,
      category: poolPlayer.category,
      role: poolPlayer.role,
      spec: poolPlayer.spec,
      points: Number(sale.pts || 0),
      lot: sale.lot || "",
      status: "Sold"
    });
  });

  stats.purse = TOTAL_PURSE - stats.spend;
  return stats;
}

function addCategory_(stats, category) {
  if (category === "Gold") stats.g++;
  else if (category === "Silver") stats.s++;
  else if (category === "Bronze") stats.b++;
}

function categoryNeeds_(stats) {
  return {
    Gold: Math.max(0, CAPS.Gold - stats.g),
    Silver: Math.max(0, CAPS.Silver - stats.s),
    Bronze: Math.max(0, CAPS.Bronze - stats.b)
  };
}

function reserveForNeeds_(needs, data) {
  const floors = ((data.rules || {}).floors) || { Gold: 15000, Silver: 5000, Bronze: 3000 };
  return Object.keys(needs).reduce(function(sum, category) {
    return sum + needs[category] * Number(floors[category] || 0);
  }, 0);
}

function categoryRank_(category) {
  if (category === "Gold") return 1;
  if (category === "Silver") return 2;
  if (category === "Bronze") return 3;
  return 9;
}

function getOrCreateSheet_(ss, name) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return sheet;
}

function writeTable_(sheet, rows) {
  sheet.clearContents();
  if (!rows.length) return;
  const width = rows.reduce(function(max, row) {
    return Math.max(max, row.length);
  }, 1);
  const padded = rows.map(function(row) {
    const next = row.slice();
    while (next.length < width) next.push("");
    return next;
  });
  sheet.getRange(1, 1, padded.length, width).setValues(padded);
  sheet.getRange(1, 1, 1, width).setFontWeight("bold");
  sheet.autoResizeColumns(1, width);
}

function safeSheetName_(name) {
  return String(name || "Team")
    .replace(/[\[\]\*\/\\\?:]/g, "-")
    .slice(0, 100);
}

function json_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function adminKey_() {
  return PropertiesService.getScriptProperties().getProperty("ADMIN_KEY") || "";
}
