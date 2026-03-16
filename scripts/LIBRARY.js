// DCP standalone merged library v1.4.6
// Includes DCP profiles and DCPTime in one Library file.
(function () {
  "use strict";

  var SECTIONS = [
    "appearance", "personality", "history", "abilities", "quirks",
    "relationships", "speech", "mannerisms", "species", "other"
  ];
  var B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  var WIDGET_IDS = ["dcp_active", "dcp_budget", "dcp_focus"];

  function trimStr(s) {
    return String(s || "").replace(/^\s+|\s+$/g, "");
  }

  function lowerStr(s) {
    return trimStr(s).toLowerCase();
  }

  function normalizeName(name) {
    return lowerStr(name);
  }

  function safeText(value) {
    return (typeof value === "string") ? value : "";
  }

  function pad2(n) {
    n = parseInt(n, 10);
    if (isNaN(n)) n = 0;
    return (n < 10 ? "0" : "") + String(n);
  }

  function ensurePlainObject(value) {
    return (value && typeof value === "object" && !Array.isArray(value)) ? value : {};
  }

  function isWordBoundary(ch) {
    return !ch || " \t\n\r.,!?;:'\"-()[]{}/<>@#$%^&*~`+=|\\".indexOf(ch) !== -1;
  }

  function containsWord(source, word) {
    source = String(source || "").toLowerCase();
    word = String(word || "").toLowerCase();
    if (!word) return false;
    var idx = 0;
    while (true) {
      idx = source.indexOf(word, idx);
      if (idx === -1) return false;
      var before = (idx === 0) || isWordBoundary(source.charAt(idx - 1));
      var after = (idx + word.length >= source.length) || isWordBoundary(source.charAt(idx + word.length));
      if (before && after) return true;
      idx += 1;
    }
  }

  function startsWithCommand(raw, token) {
    raw = lowerStr(raw);
    token = lowerStr(token);
    return raw.indexOf(token) === 0 && (raw.length === token.length || raw.charAt(token.length) === " ");
  }

  function isCommandBoundary(ch) {
    return !ch || " \t\r\n\"'`([{<".indexOf(ch) !== -1;
  }

  function stripOuterQuotes(s) {
    s = trimStr(s);
    while (s && "\"'`".indexOf(s.charAt(0)) !== -1) s = trimStr(s.substring(1));
    while (s && "\"'`".indexOf(s.charAt(s.length - 1)) !== -1) s = trimStr(s.substring(0, s.length - 1));
    return s;
  }

  function stripTrailingCommandNoise(s) {
    s = trimStr(s);
    while (s && "\"'`".indexOf(s.charAt(s.length - 1)) !== -1) s = trimStr(s.substring(0, s.length - 1));
    while (s && ".!?".indexOf(s.charAt(s.length - 1)) !== -1) s = trimStr(s.substring(0, s.length - 1));
    while (s && "\"'`".indexOf(s.charAt(s.length - 1)) !== -1) s = trimStr(s.substring(0, s.length - 1));
    return s;
  }

  function canonicalizeCommandPrefix(raw, token) {
    raw = String(raw || "");
    token = lowerStr(token);
    return (lowerStr(raw).indexOf(token) === 0) ? (token + raw.substring(token.length)) : raw;
  }

  function extractEmbeddedCommand(raw, token) {
    raw = String(raw || "");
    token = lowerStr(token);
    var lower = raw.toLowerCase();
    var idx = lower.indexOf(token);
    while (idx !== -1) {
      if (idx === 0 || isCommandBoundary(raw.charAt(idx - 1))) {
        return stripTrailingCommandNoise(stripOuterQuotes(canonicalizeCommandPrefix(raw.substring(idx), token)));
      }
      idx = lower.indexOf(token, idx + 1);
    }
    return "";
  }

  function extractAnyCommand(raw) {
    return extractEmbeddedCommand(raw, "/profile") || extractEmbeddedCommand(raw, "/time") || "";
  }

  function profileSize(profile) {
    var total = 0;
    var sections = (profile && profile.sections) || {};
    for (var key in sections) {
      if (sections.hasOwnProperty(key) && typeof sections[key] === "string") total += sections[key].length;
    }
    return total;
  }

  function parseKeywords(str) {
    var source = String(str || "");
    var parts = (source.indexOf(",") !== -1) ? source.split(",") : source.split(/\s+/);
    var out = [];
    var seen = {};
    for (var i = 0; i < parts.length; i++) {
      var word = lowerStr(parts[i]);
      if (word && !seen[word]) {
        seen[word] = true;
        out.push(word);
      }
    }
    return out;
  }

  function defaultSectionKeywords() {
    return {
      appearance: ["appearance","look","looks","looked","describe","description","features","face","eyes","hair","body","height","build","clothing","clothes","outfit","wearing","uniform","armor"],
      personality: ["personality","temperament","attitude","demeanor","mood","emotion","feeling","feel","feels","calm","angry","nervous","confident","shy","kind","cruel","friendly","polite","rude","humor"],
      history: ["history","backstory","background","past","origin","grew up","childhood","before","previously","once","years ago","remember","memory","memories","former","used to"],
      abilities: ["abilities","ability","power","powers","skills","skill","talent","talents","strength","weakness","fight","combat","attack","defend","magic","spell","weapon","tactics","capable","can"],
      quirks: ["quirk","quirks","habit","habits","odd","peculiar","strange","unusual","tick","tics","obsession","fear","phobia","favorite","routine","compulsion"],
      relationships: ["relationship","relationships","friend","friends","enemy","enemies","rival","ally","partner","family","parent","sibling","mentor","student","bond","trust","loyal","romance"],
      speech: ["speech","voice","tone","accent","says","said","speak","speaks","speaking","whisper","shout","dialogue","phrase","phrasing","word choice"],
      mannerisms: ["mannerism","mannerisms","gesture","gestures","posture","movement","moves","walk","walks","stance","fidget","nod","shrug","glance","expression","body language"],
      species: ["species","race","lineage","ancestry","biology","anatomy","physiology","human","humanoid","creature","beast","monster","nonhuman","instinct","traits"],
      other: ["other","misc","miscellaneous","notes","detail","details","extra","additional","general","context"]
    };
  }

  function getSectionKeywords(overrides) {
    var base = defaultSectionKeywords();
    var custom = ensurePlainObject(overrides);
    for (var section in custom) {
      if (!custom.hasOwnProperty(section)) continue;
      if (SECTIONS.indexOf(section) === -1) continue;
      if (!custom[section] || !custom[section].length) continue;
      for (var i = 0; i < custom[section].length; i++) {
        var keyword = lowerStr(custom[section][i]);
        if (keyword && base[section].indexOf(keyword) === -1) base[section].push(keyword);
      }
    }
    return base;
  }

  function stripBDTags(str) {
    return String(str || "").replace(/\[\[BD:[\s\S]*?:BD\]\]/g, "");
  }

  function bdMessage(payload) {
    return "[[BD:" + JSON.stringify(payload) + ":BD]]";
  }

  function bdDestroy(id) {
    return bdMessage({ type: "widget", widgetId: id, action: "destroy" });
  }

  function destroyDebugWidgets() {
    var out = "";
    for (var i = 0; i < WIDGET_IDS.length; i++) out += bdDestroy(WIDGET_IDS[i]);
    return out;
  }

  function buildDebugWidgets(S, runtime) {
    if (!S.config.widgets || !S.config.debug) return "";
    runtime = runtime || {};
    var out = "";
    out += bdMessage({ type: "widget", widgetId: "dcp_active", action: "create", config: { type: "stat", label: "Active", value: runtime.activeCount || 0, align: "left", order: 1, color: "#22c55e" } });
    out += bdMessage({ type: "widget", widgetId: "dcp_budget", action: "create", config: { type: "stat", label: "Inject", value: String(runtime.used || 0) + "/" + String((runtime.activeCount || 0) * (S.config.budget || 0)), align: "right", order: 1, color: "#60a5fa" } });
    if (runtime.top && runtime.top.length) {
      out += bdMessage({ type: "widget", widgetId: "dcp_focus", action: "create", config: { type: "badge", text: "Focus: " + runtime.top.join(", "), variant: "subtle", align: "center", order: 1, color: "#f59e0b" } });
    }
    return out;
  }

  function normalizeBase64Input(input) {
    var s = String(input || "").replace(/\r|\n|\t/g, "").replace(/-/g, "+").replace(/_/g, "/");
    if (s.indexOf(" ") !== -1 && s.indexOf("+") === -1) s = s.replace(/ /g, "+");
    s = s.replace(/\s+/g, "");
    while (s && (s.length % 4) !== 0) s += "=";
    return s;
  }

  function bytesToBase64(bytes) {
    if (!bytes || !bytes.length) return "";
    var out = "";
    for (var i = 0; i < bytes.length; i += 3) {
      var a = bytes[i] & 255;
      var b = (i + 1 < bytes.length) ? (bytes[i + 1] & 255) : NaN;
      var c = (i + 2 < bytes.length) ? (bytes[i + 2] & 255) : NaN;
      var triplet = (a << 16) | ((isNaN(b) ? 0 : b) << 8) | (isNaN(c) ? 0 : c);
      out += B64.charAt((triplet >> 18) & 63);
      out += B64.charAt((triplet >> 12) & 63);
      out += isNaN(b) ? "=" : B64.charAt((triplet >> 6) & 63);
      out += isNaN(c) ? "=" : B64.charAt(triplet & 63);
    }
    return out;
  }

  function base64ToBytes(input) {
    var clean = String(input || "").replace(/\s+/g, "");
    if (!clean) return [];
    if ((clean.length % 4) !== 0) return null;
    var map = {};
    for (var i = 0; i < B64.length; i++) map[B64.charAt(i)] = i;
    var out = [];
    for (var j = 0; j < clean.length; j += 4) {
      var c1 = clean.charAt(j), c2 = clean.charAt(j + 1), c3 = clean.charAt(j + 2), c4 = clean.charAt(j + 3);
      if (c1 === "=" || c2 === "=") return null;
      var v1 = map[c1], v2 = map[c2], pad3 = (c3 === "="), pad4 = (c4 === "="), v3 = 0, v4 = 0;
      if (v1 === undefined || v2 === undefined) return null;
      if (!pad3) { v3 = map[c3]; if (v3 === undefined) return null; } else if (!pad4) return null;
      if (!pad4) { v4 = map[c4]; if (v4 === undefined) return null; }
      var triplet = (v1 << 18) | (v2 << 12) | (v3 << 6) | v4;
      out.push((triplet >> 16) & 255);
      if (!pad3) out.push((triplet >> 8) & 255);
      if (!pad4) out.push(triplet & 255);
      if ((pad3 || pad4) && (j + 4 < clean.length)) return null;
    }
    return out;
  }
  function utf8ToBytes(str) {
    if (typeof TextEncoder === "function") {
      try {
        var enc = new TextEncoder().encode(str);
        var out = [];
        for (var i = 0; i < enc.length; i++) out.push(enc[i]);
        return out;
      } catch (e) {}
    }
    var utf8 = unescape(encodeURIComponent(str));
    var arr = [];
    for (var j = 0; j < utf8.length; j++) arr.push(utf8.charCodeAt(j));
    return arr;
  }

  function bytesToUtf8(bytes) {
    if (typeof TextDecoder === "function") {
      try {
        return new TextDecoder().decode(new Uint8Array(bytes));
      } catch (e) {}
    }
    var bin = "";
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    try {
      return decodeURIComponent(escape(bin));
    } catch (e2) {
      return null;
    }
  }

  function toBase64(str) {
    if (!str) return "";
    str = String(str);
    var out = "";
    if (typeof btoa === "function") {
      try { out = btoa(unescape(encodeURIComponent(str))); } catch (e) {}
    }
    if (!out && typeof Buffer !== "undefined" && Buffer && typeof Buffer.from === "function") {
      try { out = Buffer.from(str, "utf8").toString("base64"); } catch (e2) {}
    }
    if (!out) out = bytesToBase64(utf8ToBytes(str));
    return out.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function fromBase64(str) {
    if (!str) return "";
    var input = normalizeBase64Input(str);
    if (!input) return "";
    if (typeof atob === "function") {
      try { return decodeURIComponent(escape(atob(input))); } catch (e) {}
    }
    if (typeof Buffer !== "undefined" && Buffer && typeof Buffer.from === "function") {
      try { return Buffer.from(input, "base64").toString("utf8"); } catch (e2) {}
    }
    var bytes = base64ToBytes(input);
    if (bytes === null) return null;
    return bytesToUtf8(bytes);
  }

  function ensureDcpState() {
    if (!state.dcp || typeof state.dcp !== "object" || Array.isArray(state.dcp)) state.dcp = {};
    var S = state.dcp;
    if (!S.profiles || typeof S.profiles !== "object" || Array.isArray(S.profiles)) S.profiles = {};
    if (!S.config || typeof S.config !== "object" || Array.isArray(S.config)) S.config = {};
    if (typeof S._pending !== "string") S._pending = "";
    if (typeof S._pendingSource !== "string") S._pendingSource = "";
    if (typeof S._widgetClearPending !== "boolean") S._widgetClearPending = false;
    if (typeof S._widgetActive !== "boolean") S._widgetActive = false;
    if (!S.importBuffer || typeof S.importBuffer !== "object" || Array.isArray(S.importBuffer)) S.importBuffer = { active: false, mode: "merge", payload: "" };

    S.config.budget = parseInt(S.config.budget, 10);
    if (isNaN(S.config.budget) || S.config.budget < 100) S.config.budget = 800;
    S.config.fallback = lowerStr(S.config.fallback || "personality");
    if (SECTIONS.indexOf(S.config.fallback) === -1) S.config.fallback = "personality";
    S.config.debug = !!S.config.debug;
    S.config.widgets = !!S.config.widgets;
    S.config.maxActive = parseInt(S.config.maxActive, 10);
    if (isNaN(S.config.maxActive) || S.config.maxActive < 0) S.config.maxActive = 0;
    if (!S.config.sectionKeywords || typeof S.config.sectionKeywords !== "object" || Array.isArray(S.config.sectionKeywords)) S.config.sectionKeywords = {};

    if (typeof S.importBuffer.active !== "boolean") S.importBuffer.active = false;
    if (S.importBuffer.mode !== "replace") S.importBuffer.mode = "merge";
    if (typeof S.importBuffer.payload !== "string") S.importBuffer.payload = "";
    return S;
  }

  function setPendingMessage(S, source, msg) {
    state.message = msg;
    S._pending = msg;
    S._pendingSource = source;
    globalThis.text = " ";
    globalThis.stop = false;
  }

  function clearPendingMessage(S) {
    S._pending = "";
    S._pendingSource = "";
  }

  function ensureTimeState() {
    if (!state.dcpTime || typeof state.dcpTime !== "object" || Array.isArray(state.dcpTime)) state.dcpTime = {};
    var T = state.dcpTime;
    if (typeof T.enabled !== "boolean") T.enabled = true;
    if (typeof T.showContext !== "boolean") T.showContext = true;
    if (typeof T.showOutput !== "boolean") T.showOutput = true;
    if (typeof T.showStateMessage !== "boolean") T.showStateMessage = false;
    if (typeof T.minutesPerAction !== "number") T.minutesPerAction = 10;
    if (typeof T.day !== "number") T.day = 1;
    if (typeof T.hour !== "number") T.hour = 8;
    if (typeof T.minute !== "number") T.minute = 0;
    if (typeof T.phase !== "string") T.phase = "Morning";
    if (typeof T.lastInput !== "string") T.lastInput = "";
    if (typeof T.lastAdvanceAction !== "number") T.lastAdvanceAction = -1;
    normalizeTime(T);
    return T;
  }

  function normalizeTime(T) {
    T.minutesPerAction = parseInt(T.minutesPerAction, 10);
    if (isNaN(T.minutesPerAction) || T.minutesPerAction < 1 || T.minutesPerAction > 60) T.minutesPerAction = 10;
    T.day = parseInt(T.day, 10);
    if (isNaN(T.day) || T.day < 1) T.day = 1;
    T.hour = parseInt(T.hour, 10);
    if (isNaN(T.hour)) T.hour = 8;
    T.minute = parseInt(T.minute, 10);
    if (isNaN(T.minute)) T.minute = 0;

    var totalMinutes = ((T.day - 1) * 1440) + (T.hour * 60) + T.minute;
    if (totalMinutes < 0) totalMinutes = 0;
    T.day = Math.floor(totalMinutes / 1440) + 1;
    totalMinutes = totalMinutes % 1440;
    T.hour = Math.floor(totalMinutes / 60);
    T.minute = totalMinutes % 60;

    if (T.hour >= 6 && T.hour < 12) T.phase = "Morning";
    else if (T.hour >= 12 && T.hour < 17) T.phase = "Afternoon";
    else if (T.hour >= 17 && T.hour < 20) T.phase = "Evening";
    else T.phase = "Night";

    T.enabled = (T.enabled !== false);
    T.showContext = (T.showContext !== false);
    T.showOutput = (T.showOutput !== false);
    T.showStateMessage = !!T.showStateMessage;
    T.lastInput = String(T.lastInput || "");
    T.lastAdvanceAction = parseInt(T.lastAdvanceAction, 10);
    if (isNaN(T.lastAdvanceAction)) T.lastAdvanceAction = -1;
  }

  function parseOnOff(value) {
    value = lowerStr(value);
    if (value === "on" || value === "true" || value === "1" || value === "yes") return true;
    if (value === "off" || value === "false" || value === "0" || value === "no") return false;
    return null;
  }

  function parseHHMM(raw) {
    var match = trimStr(raw).match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    var hh = parseInt(match[1], 10);
    var mm = parseInt(match[2], 10);
    return (isNaN(hh) || isNaN(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) ? null : [hh, mm];
  }

  function parseDuration(raw) {
    var out = { d: 0, h: 0, m: 0, ok: false };
    var toks = trimStr(raw).toLowerCase().split(/\s+/);
    for (var i = 0; i < toks.length; i++) {
      var x = null;
      if ((x = toks[i].match(/^(\d+)d$/))) { out.d += parseInt(x[1], 10); out.ok = true; }
      else if ((x = toks[i].match(/^(\d+)h$/))) { out.h += parseInt(x[1], 10); out.ok = true; }
      else if ((x = toks[i].match(/^(\d+)m$/))) { out.m += parseInt(x[1], 10); out.ok = true; }
      else if ((x = toks[i].match(/^(\d+)$/))) { out.m += parseInt(x[1], 10); out.ok = true; }
    }
    return out;
  }

  function getActionCount() {
    return (typeof info !== "undefined" && info && typeof info.actionCount === "number") ? Math.abs(parseInt(info.actionCount, 10)) : -1;
  }

  function applyTimeMacros(T, lowerInput) {
    if (lowerInput.indexOf("go to sleep") !== -1) {
      T.hour = 8;
      T.minute = 0;
      T.day += 1;
      return;
    }
    if (lowerInput.indexOf("rest a bit") !== -1) {
      T.hour += 4;
      return;
    }
    if (lowerInput.indexOf("fly to the moon") !== -1) {
      T.hour += 16;
      T.minute += 30;
    }
  }

  function advanceTurnTime(T) {
    var delta = parseInt(T.minutesPerAction, 10);
    var baseMinute = parseInt(T.minute, 10);
    if (isNaN(delta) || delta < 1) delta = 10;
    if (isNaN(baseMinute) || baseMinute < 0) baseMinute = 0;
    T.minute = baseMinute + delta;
    if (T.minute >= 60) {
      T.hour += Math.floor(T.minute / 60);
      T.minute = 0;
    }
  }

  function profileHelpText() {
    return [
      "=== DCP Commands ===",
      "/profile add <name>",
      "/profile remove <name>",
      "/profile show <name>",
      "/profile list",
      "/profile set <name> <section> <text>",
      "/profile append <name> <section> <text>",
      "/profile keywords <name> <word1,word2,...>",
      "/profile import <name> [section] text...",
      "/profile importb64 <name> [section] <base64>...",
      "/profile importallb64 [merge|replace] <base64>",
      "/profile importallb64 begin [merge|replace]",
      "/profile importallb64 chunk <base64-part>",
      "/profile importallb64 finish",
      "/profile exportallchunks [merge|replace] [chunkSize]",
      "/profile export <name>",
      "/profile exportb64 <name>",
      "/profile exportallb64",
      "/profile config [budget|fallback|debug|maxActive|keywords|widgets] [value]",
      "/profile sections",
      "Batch: separate commands with ;;"
    ].join("\n");
  }

  function timeHelpText() {
    return [
      "=== DCP Time Commands ===",
      "/time show",
      "/time set <HH:MM> [nextday]",
      "/time add <Nd Nh Nm>",
      "/time config",
      "/time config enabled <on|off>",
      "/time config context <on|off>",
      "/time config output <on|off>",
      "/time config message <on|off>",
      "/time config minutes <1-60>"
    ].join("\n");
  }

  function importAllProfiles(S, payloadB64, mode, results) {
    var decoded = fromBase64(payloadB64);
    if (decoded === null) { results.push("Invalid base64 payload."); return false; }
    var parsed = null;
    try { parsed = JSON.parse(decoded); } catch (e) { results.push("Invalid payload JSON."); return false; }
    var source = parsed && (parsed.p || parsed.profiles);
    if (!source || typeof source !== "object") { results.push("Payload missing profiles."); return false; }
    if (mode === "replace") S.profiles = {};
    var created = 0, updated = 0, skipped = 0;
    for (var rawName in source) {
      if (!source.hasOwnProperty(rawName)) continue;
      var name = normalizeName(rawName);
      if (!name) { skipped += 1; continue; }
      var srcProfile = ensurePlainObject(source[rawName]);
      var srcSections = ensurePlainObject(srcProfile.sections);
      var cleanSections = {};
      for (var i = 0; i < SECTIONS.length; i++) {
        var section = SECTIONS[i];
        var val = srcSections[section];
        if (typeof val === "string" && trimStr(val)) cleanSections[section] = val;
      }
      var cleanKeywords = [];
      if (srcProfile.keywords && srcProfile.keywords.length) {
        for (var k = 0; k < srcProfile.keywords.length; k++) {
          var keyword = normalizeName(srcProfile.keywords[k]);
          if (keyword && cleanKeywords.indexOf(keyword) === -1) cleanKeywords.push(keyword);
        }
      }
      if (!cleanKeywords.length) cleanKeywords.push(name);
      if (S.profiles[name]) updated += 1; else created += 1;
      S.profiles[name] = { keywords: cleanKeywords, sections: cleanSections };
    }
    results.push("Imported all profiles (" + mode + "): created=" + created + ", updated=" + updated + ", skipped=" + skipped + ", total=" + (created + updated));
    return true;
  }
  function handleProfileCommand(cmd, S, results) {
    var argStr = trimStr(cmd.substring("/profile".length));
    var sp = argStr.indexOf(" ");
    var action = lowerStr(sp === -1 ? argStr : argStr.substring(0, sp));
    var rest = trimStr(sp === -1 ? "" : argStr.substring(sp + 1));

    if (!action || action === "help") {
      results.push(profileHelpText());
      return;
    }

    if (action === "sections") {
      results.push("Sections: " + SECTIONS.join(", "));
      return;
    }

    if (action === "list") {
      var names = [];
      for (var key in S.profiles) {
        if (S.profiles.hasOwnProperty(key)) names.push(key + " (" + profileSize(S.profiles[key]) + ")");
      }
      results.push(names.length ? ("Profiles: " + names.join(", ")) : "No profiles stored.");
      return;
    }

    if (action === "add") {
      var addName = normalizeName(rest.split(" ")[0]);
      if (!addName) { results.push("Usage: /profile add <name>"); return; }
      if (S.profiles[addName]) { results.push(addName + " already exists."); return; }
      S.profiles[addName] = { keywords: [addName], sections: {} };
      results.push("Created " + addName + ".");
      return;
    }

    if (action === "remove" || action === "delete") {
      var removeName = normalizeName(rest.split(" ")[0]);
      if (!removeName || !S.profiles[removeName]) { results.push("Not found: " + (removeName || "?")); return; }
      delete S.profiles[removeName];
      results.push("Removed " + removeName + ".");
      return;
    }

    if (action === "show") {
      var showName = normalizeName(rest.split(" ")[0]);
      if (!showName || !S.profiles[showName]) { results.push("Not found: " + (showName || "?")); return; }
      var profile = S.profiles[showName];
      var lines = ["= " + showName + " =", "Keywords: " + (profile.keywords || []).join(", ")];
      var total = 0;
      for (var s = 0; s < SECTIONS.length; s++) {
        var sec = SECTIONS[s];
        if (profile.sections && profile.sections[sec]) {
          lines.push("  " + sec + ": " + profile.sections[sec].length + " chars");
          total += profile.sections[sec].length;
        }
      }
      lines.push("Total: " + total + " chars");
      results.push(lines.join("\n"));
      return;
    }

    if (action === "set" || action === "append") {
      var p1 = rest.indexOf(" ");
      if (p1 === -1) { results.push("Usage: /profile " + action + " <name> <section> <text>"); return; }
      var name = normalizeName(rest.substring(0, p1));
      var after = trimStr(rest.substring(p1 + 1));
      var p2 = after.indexOf(" ");
      if (p2 === -1) { results.push("Usage: /profile " + action + " <name> <section> <text>"); return; }
      var section = lowerStr(after.substring(0, p2));
      var value = trimStr(after.substring(p2 + 1));
      if (!S.profiles[name]) { results.push("Not found: " + name + (action === "set" ? ". Use /profile add first." : "")); return; }
      if (SECTIONS.indexOf(section) === -1) { results.push("Bad section: " + section + (action === "set" ? ". Use /profile sections" : "")); return; }
      if (action === "set") S.profiles[name].sections[section] = value;
      else S.profiles[name].sections[section] = trimStr(safeText(S.profiles[name].sections[section]) + " " + value);
      results.push(name + "." + section + " " + (action === "set" ? "set" : "appended") + " (" + S.profiles[name].sections[section].length + " chars)");
      return;
    }

    if (action === "keywords") {
      var kp = rest.indexOf(" ");
      if (kp === -1) {
        var only = normalizeName(rest);
        if (!only || !S.profiles[only]) { results.push("Not found: " + (only || "?")); return; }
        results.push("Keywords for " + only + ": " + (S.profiles[only].keywords || []).join(", "));
        return;
      }
      var keyName = normalizeName(rest.substring(0, kp));
      var kwText = trimStr(rest.substring(kp + 1));
      if (!S.profiles[keyName]) { results.push("Not found: " + keyName); return; }
      S.profiles[keyName].keywords = parseKeywords(kwText);
      results.push("Keywords for " + keyName + ": " + S.profiles[keyName].keywords.join(", "));
      return;
    }

    if (action === "import") {
      var i1 = rest.indexOf(" ");
      if (i1 === -1) { results.push("Usage: /profile import <name> [section] text [section] text..."); return; }
      var importName = normalizeName(rest.substring(0, i1));
      var body = trimStr(rest.substring(i1 + 1));
      if (!S.profiles[importName]) S.profiles[importName] = { keywords: [importName], sections: {} };
      var count = 0, current = null, start = -1, pos = 0;
      while (pos < body.length) {
        var ob = body.indexOf("[", pos), cb = body.indexOf("]", ob);
        if (ob === -1 || cb === -1) break;
        var tag = lowerStr(body.substring(ob + 1, cb));
        if (tag === "keywords" || SECTIONS.indexOf(tag) !== -1) {
          if (current !== null && start >= 0) {
            var content = trimStr(body.substring(start, ob));
            if (content) {
              if (current === "keywords") S.profiles[importName].keywords = parseKeywords(content);
              else { S.profiles[importName].sections[current] = content; count += 1; }
            }
          }
          current = tag;
          start = cb + 1;
        }
        pos = cb + 1;
      }
      if (current !== null && start >= 0 && start <= body.length) {
        var last = trimStr(body.substring(start));
        if (last) {
          if (current === "keywords") S.profiles[importName].keywords = parseKeywords(last);
          else { S.profiles[importName].sections[current] = last; count += 1; }
        }
      }
      results.push("Imported " + count + " sections for " + importName + " (" + profileSize(S.profiles[importName]) + " chars)");
      return;
    }

    if (action === "importb64") {
      var b1 = rest.indexOf(" ");
      if (b1 === -1) { results.push("Usage: /profile importb64 <name> [section] <base64>..."); return; }
      var bName = normalizeName(rest.substring(0, b1));
      var bBody = trimStr(rest.substring(b1 + 1));
      if (!S.profiles[bName]) S.profiles[bName] = { keywords: [bName], sections: {} };
      var re = /\[([a-zA-Z]+)\]\s*([A-Za-z0-9+\/=_-]+)/g, match, imported = 0;
      while ((match = re.exec(bBody)) !== null) {
        var tag = lowerStr(match[1]);
        if (tag !== "keywords" && SECTIONS.indexOf(tag) === -1) continue;
        var decoded = fromBase64(match[2]);
        if (decoded === null) { results.push("Invalid base64 for [" + tag + "]"); continue; }
        if (tag === "keywords") S.profiles[bName].keywords = parseKeywords(decoded);
        else { S.profiles[bName].sections[tag] = decoded; imported += 1; }
      }
      results.push("Imported " + imported + " sections (b64) for " + bName + " (" + profileSize(S.profiles[bName]) + " chars)");
      return;
    }

    if (action === "importallb64") {
      var arg = trimStr(rest), lower = lowerStr(arg);
      if (!arg) { results.push("Usage: /profile importallb64 [merge|replace] <base64>"); return; }
      if (lower === "cancel" || lower === "abort") {
        S.importBuffer.active = false; S.importBuffer.mode = "merge"; S.importBuffer.payload = "";
        results.push("Import buffer cleared."); return;
      }
      if (lower === "finish" || lower === "end" || lower === "commit") {
        if (!S.importBuffer.active || !S.importBuffer.payload) { results.push("No active import buffer. Use /profile importallb64 begin first."); return; }
        var finishMode = (S.importBuffer.mode === "replace") ? "replace" : "merge";
        var payload = S.importBuffer.payload;
        S.importBuffer.active = false; S.importBuffer.mode = "merge"; S.importBuffer.payload = "";
        importAllProfiles(S, payload, finishMode, results); return;
      }
      if (lower.indexOf("begin") === 0 || lower.indexOf("start") === 0) {
        var startParts = arg.split(/\s+/), modeStart = "merge";
        if (startParts.length > 1 && (lowerStr(startParts[1]) === "merge" || lowerStr(startParts[1]) === "replace")) modeStart = lowerStr(startParts[1]);
        S.importBuffer.active = true; S.importBuffer.mode = modeStart; S.importBuffer.payload = "";
        results.push("Import buffer started (" + modeStart + "). Send chunks with /profile importallb64 chunk <data>, then /profile importallb64 finish");
        return;
      }
      if (lower.indexOf("chunk ") === 0 || lower.indexOf("append ") === 0) {
        if (!S.importBuffer.active) { results.push("No active import buffer. Use /profile importallb64 begin first."); return; }
        var chunk = trimStr(arg.replace(/^(?:chunk|append)\s+/i, ""));
        if (!chunk) { results.push("Usage: /profile importallb64 chunk <base64-part>"); return; }
        S.importBuffer.payload += chunk;
        results.push("Buffered chunk: +" + chunk.length + " chars (total " + S.importBuffer.payload.length + ")");
        return;
      }
      var mode = "merge", payloadB64 = arg, firstSpace = payloadB64.indexOf(" ");
      if (firstSpace !== -1) {
        var maybeMode = lowerStr(payloadB64.substring(0, firstSpace));
        if (maybeMode === "merge" || maybeMode === "replace") { mode = maybeMode; payloadB64 = trimStr(payloadB64.substring(firstSpace + 1)); }
      }
      if (!payloadB64) { results.push("Usage: /profile importallb64 [merge|replace] <base64>"); return; }
      importAllProfiles(S, payloadB64, mode, results);
      return;
    }

    if (action === "export" || action === "exportb64") {
      var exportName = normalizeName(rest.split(" ")[0]);
      if (!exportName || !S.profiles[exportName]) { results.push("Not found: " + (exportName || "?")); return; }
      var profile = S.profiles[exportName];
      var out = (action === "export")
        ? ("/profile import " + exportName + " [keywords] " + (profile.keywords || []).join(","))
        : ("/profile importb64 " + exportName + " [keywords] " + toBase64((profile.keywords || []).join(",")));
      for (var e = 0; e < SECTIONS.length; e++) {
        var secName = SECTIONS[e];
        if (profile.sections && profile.sections[secName]) out += " [" + secName + "] " + ((action === "export") ? profile.sections[secName] : toBase64(profile.sections[secName]));
      }
      if (action === "export") out += "\nTip: use /profile exportb64 for guaranteed round-trip safety.";
      results.push(out);
      return;
    }

    if (action === "exportallb64") {
      var countProfiles = 0;
      for (var pn in S.profiles) if (S.profiles.hasOwnProperty(pn)) countProfiles += 1;
      results.push("Profiles exported: " + countProfiles + "\n/profile importallb64 " + toBase64(JSON.stringify({ v: 1, p: S.profiles })));
      return;
    }

    if (action === "exportallchunks") {
      var args = trimStr(rest).split(/\s+/), modeChunk = "merge", chunkSize = 1200;
      if (args[0] && (lowerStr(args[0]) === "merge" || lowerStr(args[0]) === "replace")) { modeChunk = lowerStr(args[0]); args.shift(); }
      if (args[0]) {
        var maybeSize = parseInt(args[0], 10);
        if (!isNaN(maybeSize)) chunkSize = Math.max(250, Math.min(5000, maybeSize));
      }
      var totalProfiles = 0;
      for (var pnk in S.profiles) if (S.profiles.hasOwnProperty(pnk)) totalProfiles += 1;
      var payloadChunk = toBase64(JSON.stringify({ v: 1, p: S.profiles }));
      var lines = [];
      lines.push("Profiles exported: " + totalProfiles + " | payload chars=" + payloadChunk.length + " | chunkSize=" + chunkSize);
      lines.push("/profile importallb64 begin " + modeChunk);
      for (var offset = 0; offset < payloadChunk.length; offset += chunkSize) lines.push("/profile importallb64 chunk " + payloadChunk.substring(offset, offset + chunkSize));
      lines.push("/profile importallb64 finish");
      results.push(lines.join("\n"));
      return;
    }

    if (action === "config") {
      if (!rest) {
        var overrideCount = 0;
        for (var sk in S.config.sectionKeywords) if (S.config.sectionKeywords.hasOwnProperty(sk) && S.config.sectionKeywords[sk] && S.config.sectionKeywords[sk].length) overrideCount += 1;
        results.push("Config: budget=" + S.config.budget + " | fallback=" + S.config.fallback + " | debug=" + (S.config.debug ? "on" : "off") + " | maxActive=" + S.config.maxActive + " | widgets=" + (S.config.widgets ? "on" : "off") + " | keywordOverrides=" + overrideCount);
        return;
      }
      var cfg = rest.split(" "), key = lowerStr(cfg[0]), val = trimStr(cfg.slice(1).join(" "));
      if (key === "budget") {
        var num = parseInt(val, 10);
        if (isNaN(num) || num < 100) { results.push("Budget must be >= 100"); return; }
        S.config.budget = num; results.push("Budget: " + num); return;
      }
      if (key === "fallback") {
        var fallback = lowerStr(val);
        if (SECTIONS.indexOf(fallback) === -1) { results.push("Bad section: " + val); return; }
        S.config.fallback = fallback; results.push("Fallback: " + fallback); return;
      }
      if (key === "debug") {
        var debugOn = parseOnOff(val);
        if (debugOn === null) { results.push("Usage: /profile config debug <on|off>"); return; }
        if (!debugOn) S._widgetClearPending = true;
        S.config.debug = debugOn; results.push("Debug: " + (debugOn ? "on" : "off")); return;
      }
      if (key === "maxactive") {
        var ma = parseInt(val, 10);
        if (isNaN(ma) || ma < 0) { results.push("maxActive must be >= 0 (0 = no cap)"); return; }
        S.config.maxActive = ma; results.push("maxActive: " + ma + (ma === 0 ? " (no cap)" : "")); return;
      }
      if (key === "keywords") {
        var sectionAndWords = trimStr(val);
        if (!sectionAndWords) { results.push("Usage: /profile config keywords <section> <word1,word2,...> | clear"); return; }
        var spk = sectionAndWords.indexOf(" ");
        var secName = lowerStr(spk === -1 ? sectionAndWords : sectionAndWords.substring(0, spk));
        var wordsRaw = trimStr(spk === -1 ? "" : sectionAndWords.substring(spk + 1));
        if (SECTIONS.indexOf(secName) === -1) { results.push("Bad section: " + secName + ". Use /profile sections"); return; }
        if (!wordsRaw) {
          var current = S.config.sectionKeywords[secName] || [];
          results.push("Keyword override for " + secName + ": " + (current.length ? current.join(", ") : "(none)")); return;
        }
        var keywordCmd = lowerStr(wordsRaw);
        if (keywordCmd === "clear" || keywordCmd === "reset" || keywordCmd === "off") { delete S.config.sectionKeywords[secName]; results.push("Cleared keyword override for " + secName); return; }
        var parsed = parseKeywords(wordsRaw);
        if (!parsed.length) { results.push("No keywords provided."); return; }
        S.config.sectionKeywords[secName] = parsed; results.push("Keyword override for " + secName + ": " + parsed.join(", ")); return;
      }
      if (key === "widgets") {
        if (!val) { results.push("Widgets: " + (S.config.widgets ? "on" : "off")); return; }
        var widgetVal = lowerStr(val);
        if (widgetVal === "on" || widgetVal === "true" || widgetVal === "1") { S.config.widgets = true; results.push("Widgets: on (requires BetterDungeon; keep off for mobile/shared users)"); return; }
        if (widgetVal === "off" || widgetVal === "false" || widgetVal === "0") { S.config.widgets = false; S._widgetClearPending = true; results.push("Widgets: off"); return; }
        results.push("Usage: /profile config widgets <on|off>"); return;
      }
      results.push("Config keys: budget, fallback, debug, maxActive, keywords, widgets");
      return;
    }

    results.push("Unknown: " + action + ". Try /profile help");
  }

  globalThis.DCP = function DCP(hook) {
    var S = ensureDcpState();

    if (hook === "input") {
      var rawInput = String(globalThis.text || "");
      var raw = extractEmbeddedCommand(rawInput, "/profile") || trimStr(rawInput);
      if (!startsWithCommand(raw, "/profile")) return;
      var parts = raw.split(";;");
      var results = [];
      var hasCommand = false;
      for (var i = 0; i < parts.length; i++) {
        var cmd = extractEmbeddedCommand(parts[i], "/profile") || trimStr(parts[i]);
        if (!startsWithCommand(cmd, "/profile")) continue;
        hasCommand = true;
        handleProfileCommand(cmd, S, results);
      }
      if (hasCommand) setPendingMessage(S, "profile", results.join("\n---\n"));
      return;
    }

    if (hook === "context") {
      var text = stripBDTags(globalThis.text || "");
      globalThis.text = text;
      state.dcpRuntime = { activeCount: 0, activeNames: [], top: [], used: 0 };
      var profiles = S.profiles;
      var names = [];
      for (var n in profiles) if (profiles.hasOwnProperty(n)) names.push(n);
      if (!names.length) return;

      var hist = (typeof history !== "undefined" && history) ? history : [];
      var lookback = Math.min(6, hist.length);
      var recentText = "";
      for (var h = hist.length - lookback; h < hist.length; h++) if (h >= 0 && hist[h]) recentText += " " + safeText(hist[h].text || hist[h].rawText);
      recentText = stripBDTags(recentText).toLowerCase();
      var textLower = text.toLowerCase();
      var keywords = getSectionKeywords(S.config.sectionKeywords);
      var matched = [];
      for (var ni = 0; ni < names.length; ni++) {
        var charName = names[ni], profile = profiles[charName], hit = 0;
        if (!profile || !profile.keywords) continue;
        for (var kw = 0; kw < profile.keywords.length; kw++) {
          var keyword = lowerStr(profile.keywords[kw]);
          if (!keyword) continue;
          if (containsWord(recentText, keyword)) hit += 1;
          if (containsWord(textLower, keyword)) hit += 2;
        }
        if (hit > 0) matched.push({ name: charName, hit: hit });
      }
      matched.sort(function (a, b) { return (b.hit !== a.hit) ? (b.hit - a.hit) : (a.name < b.name ? -1 : (a.name > b.name ? 1 : 0)); });
      var active = [];
      for (var m = 0; m < matched.length; m++) {
        if (S.config.maxActive > 0 && active.length >= S.config.maxActive) break;
        active.push(matched[m].name);
      }
      state.dcpRuntime.activeCount = active.length;
      state.dcpRuntime.activeNames = active.slice(0, 5);
      if (!active.length) return;

      var ranked = [];
      for (var si = 0; si < SECTIONS.length; si++) {
        var sectionName = SECTIONS[si], score = 0, words = keywords[sectionName] || [];
        for (var wi = 0; wi < words.length; wi++) {
          if (containsWord(recentText, words[wi])) score += 1;
          if (containsWord(textLower, words[wi])) score += 2;
        }
        ranked.push({ cat: sectionName, score: score, order: si });
      }
      ranked.sort(function (a, b) { return (b.score !== a.score) ? (b.score - a.score) : (a.order - b.order); });
      state.dcpRuntime.top = ranked.slice(0, 3).map(function (x) { return x.cat + ":" + x.score; });

      var chunks = [];
      for (var ai = 0; ai < active.length; ai++) {
        var activeName = active[ai], pObj = profiles[activeName];
        if (!pObj || !pObj.sections) continue;
        var partsOut = [], used = 0, header = "[ " + activeName + " ]";
        used += header.length + 2;
        for (var ri = 0; ri < ranked.length; ri++) {
          if (used >= S.config.budget) break;
          var sec = ranked[ri].cat, content = safeText(pObj.sections[sec]);
          if (!content) continue;
          var label = sec + ": ", remain = S.config.budget - used;
          if (label.length + content.length <= remain) {
            partsOut.push(label + content);
            used += label.length + content.length + 1;
          } else {
            var maxContent = remain - label.length;
            if (maxContent <= 20) continue;
            var truncated = content.substring(0, maxContent), lastDot = truncated.lastIndexOf(".");
            if (lastDot > maxContent * 0.4) truncated = truncated.substring(0, lastDot + 1);
            partsOut.push(label + truncated);
            used += label.length + truncated.length + 1;
          }
        }
        if (!partsOut.length && pObj.sections[S.config.fallback]) {
          var fallback = pObj.sections[S.config.fallback];
          var maxFallback = S.config.budget - header.length - S.config.fallback.length - 4;
          if (maxFallback > 20) partsOut.push(S.config.fallback + ": " + (fallback.length > maxFallback ? fallback.substring(0, maxFallback) : fallback));
        }
        if (partsOut.length) chunks.push(header + "\n" + partsOut.join("\n"));
      }

      if (chunks.length) {
        var maxChars = (typeof info !== "undefined" && info && info.maxChars) ? info.maxChars : 8000;
        var openTag = "\n[Character Detail]\n", closeTag = "\n[/Character Detail]\n";
        var room = maxChars - text.length - openTag.length - closeTag.length;
        if (room > 64) {
          var fitted = [], usedChars = 0;
          for (var ci = 0; ci < chunks.length; ci++) {
            var sep = fitted.length ? "\n\n" : "";
            var candidate = sep + chunks[ci];
            if (usedChars + candidate.length <= room) {
              fitted.push(chunks[ci]);
              usedChars += candidate.length;
            } else {
              var remain = room - usedChars - sep.length;
              if (remain > 64) {
                var partial = chunks[ci].substring(0, remain), cut = partial.lastIndexOf("\n");
                if (cut > 32) partial = partial.substring(0, cut);
                fitted.push(partial + " ...");
              }
              break;
            }
          }
          if (fitted.length) {
            var block = openTag + fitted.join("\n\n") + closeTag;
            var lastNl = text.lastIndexOf("\n");
            globalThis.text = (lastNl > 0) ? (text.substring(0, lastNl) + block + text.substring(lastNl)) : (text + block);
            state.dcpRuntime.used = block.length;
          }
        }
      }
      return;
    }

    if (hook === "output") {
      var outText = (typeof globalThis.text === "string") ? globalThis.text : " ";
      if (S._pending) {
        outText = S._pending;
        clearPendingMessage(S);
      }
      outText = stripBDTags(outText).replace(/([.!?]["\)\]]?)([A-Z])/g, "$1 $2");
      if (S._widgetClearPending) {
        outText += destroyDebugWidgets();
        S._widgetClearPending = false;
        S._widgetActive = false;
      }
      if (S.config.widgets && S.config.debug) {
        outText += buildDebugWidgets(S, state.dcpRuntime || {});
        S._widgetActive = true;
      } else if (S._widgetActive) {
        outText += destroyDebugWidgets();
        S._widgetActive = false;
      }
      globalThis.text = outText;
      return;
    }
  };

  globalThis.DCPTime = function DCPTime(hook) {
    var T = ensureTimeState();
    var S = ensureDcpState();

    if (hook === "input") {
      var rawInput = String(globalThis.text || "");
      var extracted = extractAnyCommand(rawInput);
      T.lastInput = extracted || trimStr(rawInput);
      if (!startsWithCommand(T.lastInput, "/time")) return;

      var argStr = trimStr(T.lastInput.substring("/time".length));
      var sp = argStr.indexOf(" ");
      var action = lowerStr(sp === -1 ? argStr : argStr.substring(0, sp));
      var rest = trimStr(sp === -1 ? "" : argStr.substring(sp + 1));
      var msg = "";

      if (!action || action === "help") msg = timeHelpText();
      else if (action === "show" || action === "status") msg = "Time: " + pad2(T.hour) + ":" + pad2(T.minute) + " (" + T.phase + "), Day " + T.day + " | enabled=" + (T.enabled ? "on" : "off") + " | context=" + (T.showContext ? "on" : "off") + " | output=" + (T.showOutput ? "on" : "off") + " | message=" + (T.showStateMessage ? "on" : "off") + " | minutesPerAction=" + T.minutesPerAction;
      else if (action === "set") {
        var parts = rest ? rest.split(/\s+/) : [];
        if (!parts.length) msg = "Usage: /time set <HH:MM> [nextday]";
        else {
          var parsedTime = parseHHMM(parts[0]);
          if (!parsedTime) msg = "Bad time. Use HH:MM (24h), example: 08:00";
          else {
            T.hour = parsedTime[0];
            T.minute = parsedTime[1];
            if (parts.length > 1 && lowerStr(parts[1]) === "nextday") T.day += 1;
            normalizeTime(T);
            msg = "Time set: Day " + T.day + ", " + pad2(T.hour) + ":" + pad2(T.minute) + " (" + T.phase + ")";
          }
        }
      } else if (action === "add") {
        var duration = parseDuration(rest);
        if (!duration.ok) msg = "Usage: /time add <Nd Nh Nm> (example: /time add 1d 4h 30m)";
        else {
          T.day += duration.d;
          T.hour += duration.h;
          T.minute += duration.m;
          normalizeTime(T);
          msg = "Time advanced: Day " + T.day + ", " + pad2(T.hour) + ":" + pad2(T.minute) + " (" + T.phase + ")";
        }
      } else if (action === "config") {
        if (!rest) msg = "Time config: enabled=" + (T.enabled ? "on" : "off") + " | context=" + (T.showContext ? "on" : "off") + " | output=" + (T.showOutput ? "on" : "off") + " | message=" + (T.showStateMessage ? "on" : "off") + " | minutes=" + T.minutesPerAction + " | day=" + T.day + " | time=" + pad2(T.hour) + ":" + pad2(T.minute);
        else {
          var sp2 = rest.indexOf(" ");
          var key = lowerStr(sp2 === -1 ? rest : rest.substring(0, sp2));
          var val = trimStr(sp2 === -1 ? "" : rest.substring(sp2 + 1));
          if (key === "enabled" || key === "context" || key === "output" || key === "message") {
            var boolVal = parseOnOff(val);
            if (boolVal === null) msg = "Usage: /time config " + key + " <on|off>";
            else {
              if (key === "enabled") T.enabled = boolVal;
              else if (key === "context") T.showContext = boolVal;
              else if (key === "output") T.showOutput = boolVal;
              else T.showStateMessage = boolVal;
              msg = "Time config " + key + ": " + (boolVal ? "on" : "off");
            }
          } else if (key === "minutes") {
            var minutes = parseInt(val, 10);
            if (isNaN(minutes) || minutes < 1 || minutes > 60) msg = "Minutes must be 1-60";
            else { T.minutesPerAction = minutes; msg = "Minutes per action: " + minutes; }
          } else msg = "Time config keys: enabled, context, output, message, minutes";
        }
      } else msg = "Unknown /time command: " + action + ". Try /time help";

      setPendingMessage(S, "time", msg);
      return;
    }

    if (hook === "context") {
      normalizeTime(T);
      var actionCount = getActionCount();
      if (actionCount >= 0 && actionCount !== T.lastAdvanceAction) {
        T.lastAdvanceAction = actionCount;
        if (T.enabled) {
          var effectiveInput = trimStr(T.lastInput || "");
          var commandTurn = startsWithCommand(effectiveInput, "/profile") || startsWithCommand(effectiveInput, "/time");
          if (!commandTurn) {
            applyTimeMacros(T, effectiveInput.toLowerCase());
            advanceTurnTime(T);
            normalizeTime(T);
          }
        }
      }
      if (T.enabled && T.showContext && globalThis.stop !== true) {
        globalThis.text = String(globalThis.text || "") + "\n\n[Use this timing information: Day: " + T.day + ", Time: " + pad2(T.hour) + ":" + pad2(T.minute) + ", Phase: " + T.phase + "]";
      }
      return;
    }

    if (hook === "output") {
      normalizeTime(T);
      var commandOut = startsWithCommand(T.lastInput || "", "/profile") || startsWithCommand(T.lastInput || "", "/time");
      if (!commandOut && T.enabled && T.showOutput) {
        globalThis.text = String(globalThis.text || "") + "\n\n[Time: " + pad2(T.hour) + ":" + pad2(T.minute) + " (" + T.phase + "), Day #: " + T.day + "]";
      }
      if (!commandOut && T.enabled && T.showStateMessage) {
        state.message = "Day " + T.day + ", " + pad2(T.hour) + ":" + pad2(T.minute);
      }
      return;
    }
  };
})();
